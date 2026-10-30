/**
 * E2 交易后链路 API 验收：贷款/评估、资金监管流水、过户材料/税费/预约/登记、佣金结算、看板增强、合同全流程。
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

let app: INestApplication;

interface Envelope<T = unknown> {
  code: number;
  message: string;
  data: T;
}
interface LoginData {
  token: string;
  user: { id: string; name: string; role: string };
}
interface ContractRow {
  id: string;
  code: string;
  amount: number;
  commissionAmount: number;
  signStatus: string;
  agencyId: string;
}
interface LoanRow {
  id: string;
  code: string;
  status: string;
  amount: number;
  documents: Array<{ name: string; status: string }>;
  contract: ContractRow;
  appraisals?: Array<{ id: string }>;
}
interface EscrowRow {
  id: string;
  status: string;
  totalAmount: number;
  releasedAmount: number;
  contract: ContractRow;
  transactions: Array<{ id: string }>;
}
interface CommissionRow {
  id: string;
  status: string;
  totalCommission: number;
  allocations: Array<{ amount: number }>;
  contract: ContractRow;
}
interface TransferRow {
  contractId: string;
  registrationStatus: string | null;
}

const PASSWORD = '123456';
let adminToken = '';
let managerToken = '';
let financeToken = '';
let agentToken = '';
let buyerToken = '';
let buyer2Token = '';
let loanContract: ContractRow | null = null;
let createdLoanId = '';
let escrowId = '';
let commissionPendingId = '';
let transferContractId = '';
let buyerContractId = '';

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function login(phone: string): Promise<LoginData> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone, password: PASSWORD }).expect(201);
  return (response.body as Envelope<LoginData>).data;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  adminToken = (await login('13800000001')).token;
  managerToken = (await login('13800000003')).token;
  financeToken = (await login('13800000002')).token;
  agentToken = (await login('13800000020')).token;
  buyerToken = (await login('13800000040')).token;
  buyer2Token = (await login('13800000041')).token;

  const contracts = await request(app.getHttpServer()).get('/api/contracts').query({ status: 'signed', pageSize: 50 }).set(auth(adminToken)).expect(200);
  const signed = (contracts.body as Envelope<{ items: ContractRow[] }>).data.items;
  const loans = await request(app.getHttpServer()).get('/api/loans').query({ pageSize: 50 }).set(auth(adminToken)).expect(200);
  const loanContracts = new Set((loans.body as Envelope<{ items: LoanRow[] }>).data.items.map((item) => item.contract.id));
  loanContract = signed.find((item) => !loanContracts.has(item.id)) ?? signed[0];

  const escrows = await request(app.getHttpServer()).get('/api/escrows').query({ pageSize: 50 }).set(auth(adminToken)).expect(200);
  const escrowItems = (escrows.body as Envelope<{ items: EscrowRow[] }>).data.items;
  escrowId = (escrowItems.find((item) => item.status === 'active') ?? escrowItems[0]).id;

  const transfers = await request(app.getHttpServer()).get('/api/transfers').query({ pageSize: 50 }).set(auth(adminToken)).expect(200);
  const transferItems = (transfers.body as Envelope<{ items: TransferRow[] }>).data.items;
  transferContractId = (transferItems.find((item) => item.materialTotal === 6 && item.registrationStatus === 'submitted') ?? transferItems.find((item) => item.materialTotal === 6) ?? transferItems[0]).contractId;

  const commissions = await request(app.getHttpServer()).get('/api/commissions').query({ pageSize: 50 }).set(auth(adminToken)).expect(200);
  const commissionItems = (commissions.body as Envelope<{ items: CommissionRow[] }>).data.items;
  commissionPendingId = (commissionItems.find((item) => item.status === 'pending') ?? commissionItems[0]).id;

  const buyerContracts = await request(app.getHttpServer()).get('/api/contracts').query({ pageSize: 50 }).set(auth(buyerToken)).expect(200);
  const buyerItems = (buyerContracts.body as Envelope<{ items: ContractRow[] }>).data.items;
  buyerContractId = buyerItems[0]?.id ?? '';
});

afterAll(async () => {
  await app.close();
});

describe('贷款与评估', () => {
  it('管理员/财务/经纪人可查看贷款列表，买方 403', async () => {
    const admin = await request(app.getHttpServer()).get('/api/loans').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    expect((admin.body as Envelope<{ total: number }>).data.total).toBeGreaterThanOrEqual(4);
    await request(app.getHttpServer()).get('/api/loans').set(auth(buyerToken)).expect(403);
  });

  it('为已签署合同发起贷款（草稿）', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/loans')
      .set(auth(adminToken))
      .send({
        contractId: loanContract?.id,
        bankName: '江州银行·城东支行',
        productName: '个人二手住房按揭贷',
        amount: Math.round((loanContract?.amount ?? 2000000) * 0.5),
        termMonths: 240,
        annualRate: 3.85,
      })
      .expect(201);
    const data = (response.body as Envelope<LoanRow>).data;
    createdLoanId = data.id;
    expect(data.code).toMatch(/^LOAN\d{10}$/);
    expect(data.status).toBe('draft');
    expect(data.documents).toHaveLength(4);
  });

  it('同合同重复申请贷款 → 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/loans')
      .set(auth(adminToken))
      .send({ contractId: loanContract?.id, bankName: '江州银行', productName: '按揭贷', amount: 100000, termMonths: 120, annualRate: 4 })
      .expect(400);
    expect((response.body as Envelope).code).toBe(40901);
  });

  it('贷款金额超过合同金额 → 42201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/loans')
      .set(auth(adminToken))
      .send({ contractId: loanContract?.id, bankName: '江州银行', productName: '按揭贷', amount: (loanContract?.amount ?? 0) + 1000000, termMonths: 120, annualRate: 4 })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('材料标记上传/核验', async () => {
    const uploaded = await request(app.getHttpServer()).patch(`/api/loans/${createdLoanId}/documents`).set(auth(adminToken)).send({ name: '身份证', status: 'uploaded' }).expect(200);
    expect((uploaded.body as Envelope<LoanRow>).data.documents.find((item) => item.name === '身份证')?.status).toBe('uploaded');
    const verified = await request(app.getHttpServer()).patch(`/api/loans/${createdLoanId}/documents`).set(auth(adminToken)).send({ name: '身份证', status: 'verified' }).expect(200);
    expect((verified.body as Envelope<LoanRow>).data.documents.find((item) => item.name === '身份证')?.status).toBe('verified');
  });

  it('提交 → 批贷 → 放款（Mock）', async () => {
    const submitted = await request(app.getHttpServer()).post(`/api/loans/${createdLoanId}/submit`).set(auth(adminToken)).expect(201);
    expect((submitted.body as Envelope<LoanRow>).data.status).toBe('submitted');
    const agentReview = await request(app.getHttpServer()).post(`/api/loans/${createdLoanId}/review`).set(auth(agentToken)).send({ pass: true }).expect(403);
    expect(agentReview.status).toBe(403);
    const approved = await request(app.getHttpServer()).post(`/api/loans/${createdLoanId}/review`).set(auth(adminToken)).send({ pass: true, reason: '资质符合' }).expect(201);
    expect((approved.body as Envelope<LoanRow>).data.status).toBe('approved');
    const disbursed = await request(app.getHttpServer()).post(`/api/loans/${createdLoanId}/disburse`).set(auth(financeToken)).expect(201);
    expect((disbursed.body as Envelope<LoanRow>).data.status).toBe('disbursed');
    const duplicate = await request(app.getHttpServer()).post(`/api/loans/${createdLoanId}/disburse`).set(auth(financeToken)).expect(400);
    expect((duplicate.body as Envelope).code).toBe(42201);
  });

  it('评估委托：创建 + 出报告需评估值/报告编号', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/appraisals')
      .set(auth(adminToken))
      .send({ contractId: loanContract?.id, institutionName: '江州华信评估事务所', appointmentAt: new Date(Date.now() + 86400000).toISOString() })
      .expect(201);
    const appraisal = (created.body as Envelope<{ id: string }>).data;
    const noValue = await request(app.getHttpServer()).patch(`/api/appraisals/${appraisal.id}`).set(auth(adminToken)).send({ status: 'reported' }).expect(400);
    expect((noValue.body as Envelope).code).toBe(40001);
    const reported = await request(app.getHttpServer())
      .patch(`/api/appraisals/${appraisal.id}`)
      .set(auth(adminToken))
      .send({ status: 'reported', appraisedValue: loanContract?.amount, reportNo: 'PGBG202699999' })
      .expect(200);
    expect((reported.body as Envelope<{ status: string }>).data.status).toBe('reported');
  });
});

describe('资金监管', () => {
  it('监管列表与汇总（管理员 7 个账户）', async () => {
    const list = await request(app.getHttpServer()).get('/api/escrows').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    expect((list.body as Envelope<{ total: number }>).data.total).toBeGreaterThanOrEqual(7);
    const overview = await request(app.getHttpServer()).get('/api/escrows/overview').set(auth(adminToken)).expect(200);
    expect((overview.body as Envelope<{ accountCount: number }>).data.accountCount).toBeGreaterThanOrEqual(7);
  });

  it('财务解冻资金并更新已解冻金额；超总额解冻 42201', async () => {
    const before = await request(app.getHttpServer()).get(`/api/escrows/${escrowId}`).set(auth(adminToken)).expect(200);
    const beforeData = (before.body as Envelope<EscrowRow>).data;
    const released = await request(app.getHttpServer())
      .post(`/api/escrows/${escrowId}/transactions`)
      .set(auth(financeToken))
      .send({ type: 'release', amount: 50000, remark: 'E2 验收：解冻部分资金' })
      .expect(201);
    expect((released.body as Envelope<EscrowRow>).data.releasedAmount).toBe(beforeData.releasedAmount + 50000);
    const tooMuch = await request(app.getHttpServer())
      .post(`/api/escrows/${escrowId}/transactions`)
      .set(auth(financeToken))
      .send({ type: 'release', amount: beforeData.totalAmount })
      .expect(400);
    expect((tooMuch.body as Envelope).code).toBe(42201);
  });

  it('买方无权访问资金监管接口（403）', async () => {
    await request(app.getHttpServer()).get('/api/escrows').set(auth(buyerToken)).expect(403);
  });
});

describe('过户办理', () => {
  it('过户列表与详情：材料 6 项、税费 3 项、预约 2 条', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/transfers/${transferContractId}`).set(auth(adminToken)).expect(200);
    const data = (detail.body as Envelope<{ materials: unknown[]; taxes: unknown[]; appointments: unknown[] }>).data;
    expect(data.materials).toHaveLength(6);
    expect(data.taxes).toHaveLength(3);
    expect(data.appointments).toHaveLength(2);
  });

  it('核验材料 / 缴纳税费 / 预约办理', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/transfers/${transferContractId}`).set(auth(adminToken)).expect(200);
    const data = (detail.body as Envelope<{ materials: Array<{ id: string; status: string }>; taxes: Array<{ id: string; status: string }> }>).data;
    const pendingMaterial = data.materials.find((item) => item.status === 'pending') ?? data.materials[0];
    await request(app.getHttpServer()).patch(`/api/transfers/${transferContractId}/materials/${pendingMaterial.id}`)  .set(auth(adminToken)).send({ status: 'uploaded' }).expect(200);
    await request(app.getHttpServer()).patch(`/api/transfers/${transferContractId}/materials/${pendingMaterial.id}`)  .set(auth(adminToken)).send({ status: 'verified' }).expect(200);

    const pendingTax = data.taxes.find((item) => item.status === 'pending');
    if (pendingTax) {
      const paid = await request(app.getHttpServer()).post(`/api/transfers/${transferContractId}/taxes/${pendingTax.id}/pay`).set(auth(financeToken)).expect(201);
      expect((paid.body as Envelope<{ status: string; receiptNo: string }>).data).toMatchObject({ status: 'paid' });
      expect((paid.body as Envelope<{ receiptNo: string }>).data.receiptNo.length).toBeGreaterThan(0);
    }

    const appointment = await request(app.getHttpServer())
      .post(`/api/transfers/${transferContractId}/appointments`)
      .set(auth(adminToken))
      .send({ type: 'transfer', appointmentAt: new Date(Date.now() + 3 * 86400000).toISOString(), hallName: '江州市不动产登记中心·城东大厅' })
      .expect(201);
    const appointmentId = (appointment.body as Envelope<{ id: string }>).data.id;
    const done = await request(app.getHttpServer()).patch(`/api/transfers/appointments/${appointmentId}`).set(auth(adminToken)).send({ status: 'done' }).expect(200);
    expect((done.body as Envelope<{ status: string }>).data.status).toBe('done');
  });

  it('不动产登记状态推进：提交→受理→登簿→领证', async () => {
    const fresh = await request(app.getHttpServer()).get('/api/transfers').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    const target = (fresh.body as Envelope<{ items: TransferRow[] }>).data.items.find((item) => item.registrationStatus === 'submitted') ?? { contractId: transferContractId };
    for (const action of ['accept', 'register', 'complete']) {
      const response = await request(app.getHttpServer()).post(`/api/transfers/${target.contractId}/registration`).set(auth(adminToken)).send({ action }).expect(201);
      expect((response.body as Envelope<{ status: string }>).data.status.length).toBeGreaterThan(0);
    }
  });
});

describe('佣金结算', () => {
  it('佣金列表 7 单，分摊合计=佣金总额', async () => {
    const list = await request(app.getHttpServer()).get('/api/commissions').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    const items = (list.body as Envelope<{ items: CommissionRow[]; total: number }>).data;
    expect(items.total).toBeGreaterThanOrEqual(7);
    for (const item of items.items) {
      expect(item.allocations.reduce((sum, row) => sum + row.amount, 0)).toBe(item.totalCommission);
    }
  });

  it('确认 → 支付，重复确认 42201，经纪人无权确认 403', async () => {
    const agentAttempt = await request(app.getHttpServer()).post(`/api/commissions/${commissionPendingId}/confirm`).set(auth(agentToken)).expect(403);
    expect(agentAttempt.status).toBe(403);
    const confirmed = await request(app.getHttpServer()).post(`/api/commissions/${commissionPendingId}/confirm`).set(auth(adminToken)).expect(201);
    expect((confirmed.body as Envelope<CommissionRow>).data.status).toBe('confirmed');
    const duplicate = await request(app.getHttpServer()).post(`/api/commissions/${commissionPendingId}/confirm`).set(auth(adminToken)).expect(400);
    expect((duplicate.body as Envelope).code).toBe(42201);
    const paid = await request(app.getHttpServer()).post(`/api/commissions/${commissionPendingId}/pay`).set(auth(financeToken)).expect(201);
    expect((paid.body as Envelope<CommissionRow>).data.status).toBe('paid');
  });
});

describe('看板增强与合同全流程', () => {
  it('区域行情 5 个行政区、客群画像、转化漏斗 4 级', async () => {
    const market = await request(app.getHttpServer()).get('/api/stats/market').set(auth(adminToken)).expect(200);
    expect((market.body as Envelope<unknown[]>).data).toHaveLength(5);
    const customers = await request(app.getHttpServer()).get('/api/stats/customers').set(auth(adminToken)).expect(200);
    const profile = (customers.body as Envelope<{ total: number; budgetSegments: unknown[] }>).data;
    expect(profile.total).toBeGreaterThanOrEqual(30);
    expect(profile.budgetSegments).toHaveLength(4);
    const funnel = await request(app.getHttpServer()).get('/api/stats/funnel').set(auth(adminToken)).expect(200);
    expect((funnel.body as Envelope<{ stages: unknown[] }>).data.stages).toHaveLength(4);
  });

  it('合同全流程返回贷款/监管/材料/税费/登记/佣金', async () => {
    const response = await request(app.getHttpServer()).get(`/api/contracts/${loanContract?.id}/full-flow`).set(auth(adminToken)).expect(200);
    const data = (response.body as Envelope<Record<string, unknown>>).data;
    expect(data.contract).toBeTruthy();
    for (const key of ['loan', 'escrow', 'materials', 'taxes', 'appointments', 'registration', 'commission']) {
      expect(key in data).toBe(true);
    }
  });

  it('买方仅能查看本人合同全流程，其他买方 404', async () => {
    if (!buyerContractId) return;
    const own = await request(app.getHttpServer()).get(`/api/contracts/${buyerContractId}/full-flow`).set(auth(buyerToken)).expect(200);
    expect((own.body as Envelope<{ contract: { id: string } }>).data.contract.id).toBe(buyerContractId);
    await request(app.getHttpServer()).get(`/api/contracts/${buyerContractId}/full-flow`).set(auth(buyer2Token)).expect(404);
  });
});
