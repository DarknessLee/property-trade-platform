/**
 * M3 API 验收：客户档案/保护期/防撞单、带看日程/冲突检测/反馈评级、
 * 合同模板/发起/签署/作废/下载、交易进度顺序推进与通知、C 端我的带看/合同。
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import dayjs from 'dayjs';
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

interface ListingDto {
  id: string;
  code: string;
  title: string;
  status: string;
  totalPrice: number;
  area: number;
  community: { name: string };
}

interface CustomerDto {
  id: string;
  code: string;
  name: string;
  phone: string;
  type: string;
  level: string;
  protectionUntil: string | null;
  agent: { id: string; name: string };
  user: { id: string; name: string } | null;
}

interface ShowingDto {
  id: string;
  code: string;
  status: string;
  scheduledAt: string;
  listing: { id: string; title: string };
  customer: { id: string; name: string };
}

interface ContractDto {
  id: string;
  code: string;
  signStatus: string;
  amount: number;
  esignNo: string | null;
  listing: { id: string; title: string; code: string };
  progress: Array<{ id: string; nodeType: string; status: string; sortOrder: number }>;
  payments: Array<{ id: string; type: string; amount: number }>;
}

const PASSWORD = '123456';
let agentToken = '';
let agent2Token = '';
let managerToken = '';
let adminToken = '';
let buyerToken = '';
let sellerToken = '';
let financeToken = '';

let agentListing: ListingDto | null = null;
let agentOnSaleListings: ListingDto[] = [];
let buyerCustomer: CustomerDto | null = null;
let contractBuyerCustomer: CustomerDto | null = null;
let sellerCustomer: CustomerDto | null = null;
let secondBuyerCustomer: CustomerDto | null = null;
let createdShowingId = '';
let createdContractId = '';
let createdContractListingId = '';
let templateId = '';

async function login(phone: string): Promise<LoginData> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone, password: PASSWORD }).expect(201);
  return (response.body as Envelope<LoginData>).data;
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function futureIso(days: number, hour = 10, minute = 0): string {
  return dayjs().add(days, 'day').hour(hour).minute(minute).second(0).millisecond(0).toISOString();
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  agentToken = (await login('13800000020')).token;
  agent2Token = (await login('13800000021')).token;
  managerToken = (await login('13800000003')).token;
  adminToken = (await login('13800000001')).token;
  buyerToken = (await login('13800000040')).token;
  sellerToken = (await login('13800000060')).token;
  financeToken = (await login('13800000002')).token;

  const listings = await request(app.getHttpServer()).get('/api/listings').query({ status: 'on_sale', pageSize: 60 }).set(auth(agentToken)).expect(200);
  agentOnSaleListings = (listings.body as Envelope<{ items: ListingDto[] }>).data.items;
  agentListing = agentOnSaleListings[0] ?? null;

  const customers = await request(app.getHttpServer()).get('/api/customers').query({ pageSize: 60 }).set(auth(agentToken)).expect(200);
  const items = (customers.body as Envelope<{ items: CustomerDto[] }>).data.items;
  buyerCustomer = items.find((item) => item.type === 'buyer') ?? null;
  contractBuyerCustomer = items.find((item) => item.type === 'buyer' && item.user) ?? buyerCustomer;
  sellerCustomer = items.find((item) => item.type === 'seller') ?? null;
  secondBuyerCustomer = items.filter((item) => item.type === 'buyer')[1] ?? buyerCustomer;

  const templates = await request(app.getHttpServer()).get('/api/contracts/templates').set(auth(agentToken)).expect(200);
  templateId = (templates.body as Envelope<Array<{ id: string }>>).data[0].id;
});

afterAll(async () => {
  await app.close();
});

describe('客户档案', () => {
  it('经纪人只看到本人客户', async () => {
    const response = await request(app.getHttpServer()).get('/api/customers').set(auth(agentToken)).expect(200);
    const data = (response.body as Envelope<{ items: CustomerDto[]; total: number }>).data;
    expect(data.total).toBe(3);
    expect(data.items.every((item) => item.agent.id === data.items[0].agent.id)).toBe(true);
  });

  it('店长看到本店客户（多于单个经纪人）', async () => {
    const agentList = await request(app.getHttpServer()).get('/api/customers').set(auth(agentToken)).expect(200);
    const managerList = await request(app.getHttpServer()).get('/api/customers').query({ pageSize: 60 }).set(auth(managerToken)).expect(200);
    const agentTotal = (agentList.body as Envelope<{ total: number }>).data.total;
    const managerTotal = (managerList.body as Envelope<{ total: number }>).data.total;
    expect(managerTotal).toBeGreaterThan(agentTotal);
  });

  it('管理员看到全部 30 个客户', async () => {
    const response = await request(app.getHttpServer()).get('/api/customers').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    expect((response.body as Envelope<{ total: number }>).data.total).toBe(30);
  });

  it('买方无权访问客户档案（403）', async () => {
    await request(app.getHttpServer()).get('/api/customers').set(auth(buyerToken)).expect(403);
  });

  it('创建客户：自动编号 + 默认 30 天保护期', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/customers')
      .set(auth(agentToken))
      .send({
        name: 'M3 验收客户',
        phone: '13911112222',
        type: 'buyer',
        budgetMin: 1800000,
        budgetMax: 2600000,
        demand: '求购城东区两居，近地铁',
        tags: ['刚需', '地铁房'],
        level: 'A',
      })
      .expect(201);
    const customer = (response.body as Envelope<CustomerDto>).data;
    expect(customer.code).toBe('KH-000031');
    expect(customer.protectionUntil).not.toBeNull();
    expect(dayjs(customer.protectionUntil).isAfter(dayjs())).toBe(true);
    buyerCustomer = customer;
  });

  it('保护期内同门店重复录入同手机号 → 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/customers')
      .set(auth(agentToken))
      .send({ name: '重复客户', phone: '13911112222', type: 'buyer' })
      .expect(400);
    expect((response.body as Envelope).code).toBe(40901);
  });

  it('续期保护期并更新跟进信息', async () => {
    const protect = await request(app.getHttpServer())
      .post(`/api/customers/${buyerCustomer?.id}/protect`)
      .set(auth(agentToken))
      .send({ days: 45 })
      .expect(201);
    const protectedCustomer = (protect.body as Envelope<CustomerDto>).data;
    expect(dayjs(protectedCustomer.protectionUntil).diff(dayjs(), 'day')).toBeGreaterThanOrEqual(43);

    const update = await request(app.getHttpServer())
      .patch(`/api/customers/${buyerCustomer?.id}`)
      .set(auth(agentToken))
      .send({ level: 'B', demand: '预算调整为 200-280 万' })
      .expect(200);
    expect((update.body as Envelope<CustomerDto>).data.level).toBe('B');
  });

  it('客户选项按数据范围返回', async () => {
    const response = await request(app.getHttpServer()).get('/api/customers/options').set(auth(agentToken)).expect(200);
    const options = (response.body as Envelope<Array<{ id: string; name: string; type: string }>>).data;
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((item) => ['buyer', 'seller'].includes(item.type))).toBe(true);
  });
});

describe('带看管理', () => {
  it('经纪人查询本人带看记录', async () => {
    const response = await request(app.getHttpServer()).get('/api/showings').query({ pageSize: 60 }).set(auth(agentToken)).expect(200);
    const data = (response.body as Envelope<{ items: ShowingDto[]; total: number }>).data;
    expect(data.total).toBeGreaterThan(0);
    expect(data.items.every((item) => item.code.startsWith('DK'))).toBe(true);
  });

  it('周历返回 7 天', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/showings/calendar')
      .query({ weekStart: dayjs().format('YYYY-MM-DD') })
      .set(auth(agentToken))
      .expect(200);
    const data = (response.body as Envelope<{ weekStart: string; days: Array<{ date: string; items: unknown[] }> }>).data;
    expect(data.days).toHaveLength(7);
    expect(data.days[0].date).toBe(dayjs().format('YYYY-MM-DD'));
  });

  it('新增带看预约（未来时间，状态待确认）', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/showings')
      .set(auth(agentToken))
      .send({ listingId: agentListing?.id, customerId: buyerCustomer?.id, scheduledAt: futureIso(20, 9, 30), durationMin: 45 })
      .expect(201);
    const showing = (response.body as Envelope<ShowingDto>).data;
    createdShowingId = showing.id;
    expect(showing.status).toBe('pending');
    expect(showing.code).toMatch(/^DK\d{12}$/);
  });

  it('同经纪人同时间段冲突 → 42201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/showings')
      .set(auth(agentToken))
      .send({ listingId: agentListing?.id, customerId: buyerCustomer?.id, scheduledAt: futureIso(20, 9, 50), durationMin: 30 })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('预约时间早于当前 → 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/showings')
      .set(auth(agentToken))
      .send({ listingId: agentListing?.id, customerId: buyerCustomer?.id, scheduledAt: dayjs().subtract(1, 'day').toISOString() })
      .expect(400);
    expect((response.body as Envelope).code).toBe(40001);
  });

  it('带看状态流转：待确认→已确认→完成需反馈', async () => {
    const confirm = await request(app.getHttpServer())
      .patch(`/api/showings/${createdShowingId}`)
      .set(auth(agentToken))
      .send({ status: 'confirmed' })
      .expect(200);
    expect((confirm.body as Envelope<ShowingDto>).data.status).toBe('confirmed');

    const noFeedback = await request(app.getHttpServer())
      .patch(`/api/showings/${createdShowingId}`)
      .set(auth(agentToken))
      .send({ status: 'done' })
      .expect(400);
    expect((noFeedback.body as Envelope).code).toBe(42201);

    const done = await request(app.getHttpServer())
      .patch(`/api/showings/${createdShowingId}`)
      .set(auth(agentToken))
      .send({ status: 'done', feedback: '客户满意户型，价格需再谈', rating: 'A' })
      .expect(200);
    const showing = (done.body as Envelope<ShowingDto>).data;
    expect(showing.status).toBe('done');
  });

  it('已完成带看不可再修改（42201）', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/showings/${createdShowingId}`)
      .set(auth(agentToken))
      .send({ status: 'cancelled' })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('跨经纪人不能修改他人带看（404）', async () => {
    await request(app.getHttpServer())
      .patch(`/api/showings/${createdShowingId}`)
      .set(auth(agent2Token))
      .send({ status: 'confirmed' })
      .expect(404);
  });
});

describe('C 端带看', () => {
  it('买方查看我的带看', async () => {
    const response = await request(app.getHttpServer()).get('/api/showings/my').set(auth(buyerToken)).expect(200);
    expect(Array.isArray((response.body as Envelope<ShowingDto[]>).data)).toBe(true);
  });

  it('买方预约带看 → 取消', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/showings/my')
      .set(auth(buyerToken))
      .send({ listingId: agentListing?.id, scheduledAt: futureIso(25, 14, 0) })
      .expect(201);
    const showing = (create.body as Envelope<ShowingDto>).data;
    expect(showing.status).toBe('pending');

    const cancel = await request(app.getHttpServer()).patch(`/api/showings/my/${showing.id}/cancel`).set(auth(buyerToken)).expect(200);
    expect((cancel.body as Envelope<ShowingDto>).data.status).toBe('cancelled');
  });

  it('卖方无权使用买方预约接口（403）', async () => {
    await request(app.getHttpServer()).get('/api/showings/my').set(auth(sellerToken)).expect(403);
  });
});

describe('合同签约', () => {
  it('合同模板列表（2 个启用模板）', async () => {
    const response = await request(app.getHttpServer()).get('/api/contracts/templates').set(auth(agentToken)).expect(200);
    const templates = (response.body as Envelope<Array<{ id: string; name: string }>>).data;
    expect(templates.length).toBe(2);
  });

  it('发起合同：金额=房源总价，自动生成 5 个进度节点', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/contracts')
      .set(auth(agentToken))
      .send({
        listingId: agentListing?.id,
        buyerCustomerId: contractBuyerCustomer?.id,
        sellerCustomerId: sellerCustomer?.id,
        templateId,
      })
      .expect(201);
    const contract = (response.body as Envelope<ContractDto>).data;
    createdContractId = contract.id;
    createdContractListingId = contract.listing.id;
    expect(contract.code).toMatch(/^HT\d{10}$/);
    expect(contract.signStatus).toBe('draft');
    expect(contract.amount).toBe(agentListing?.totalPrice);
    expect(contract.progress).toHaveLength(5);
    expect(contract.progress.map((node) => node.nodeType)).toEqual(['sign', 'loan', 'tax', 'transfer', 'handover']);
  });

  it('合同金额与挂牌总价不一致 → 42201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/contracts')
      .set(auth(agentToken))
      .send({
        listingId: agentListing?.id,
        buyerCustomerId: contractBuyerCustomer?.id,
        sellerCustomerId: sellerCustomer?.id,
        templateId,
        amount: (agentListing?.totalPrice ?? 0) + 10000,
      })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('非在售房源不可发起签约（42201）', async () => {
    const signed = await request(app.getHttpServer()).get('/api/listings').query({ status: 'signed', pageSize: 1 }).set(auth(adminToken)).expect(200);
    const listing = (signed.body as Envelope<{ items: ListingDto[] }>).data.items[0];
    const response = await request(app.getHttpServer())
      .post('/api/contracts')
      .set(auth(agentToken))
      .send({ listingId: listing.id, buyerCustomerId: contractBuyerCustomer?.id, sellerCustomerId: sellerCustomer?.id, templateId })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('经纪人查看本人合同；买方查看本人合同', async () => {
    const agentList = await request(app.getHttpServer()).get('/api/contracts').query({ pageSize: 60 }).set(auth(agentToken)).expect(200);
    expect((agentList.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);

    const buyerList = await request(app.getHttpServer()).get('/api/contracts').query({ pageSize: 60 }).set(auth(buyerToken)).expect(200);
    expect((buyerList.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);
  });

  it('买方无权创建合同（403）', async () => {
    await request(app.getHttpServer())
      .post('/api/contracts')
      .set(auth(buyerToken))
      .send({ listingId: agentListing?.id, buyerCustomerId: buyerCustomer?.id, sellerCustomerId: sellerCustomer?.id, templateId })
      .expect(403);
  });

  it('签署合同（Mock 电子签）：生成存证编号，房源转为已签约', async () => {
    const response = await request(app.getHttpServer()).post(`/api/contracts/${createdContractId}/sign`).set(auth(agentToken)).expect(201);
    const contract = (response.body as Envelope<ContractDto>).data;
    expect(contract.signStatus).toBe('signed');
    expect(contract.esignNo).toMatch(/^ESIGN-\d{4}-\d{6}$/);

    const listing = await request(app.getHttpServer()).get(`/api/listings/${createdContractListingId}`).set(auth(agentToken)).expect(200);
    expect((listing.body as Envelope<ListingDto>).data.status).toBe('signed');
  });

  it('重复签署 → 42201', async () => {
    const response = await request(app.getHttpServer()).post(`/api/contracts/${createdContractId}/sign`).set(auth(agentToken)).expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('合同下载返回 PDF 文件', async () => {
    const response = await request(app.getHttpServer()).get(`/api/contracts/${createdContractId}/download`).set(auth(agentToken)).expect(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    const buffer = response.body as Buffer;
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('财务可只读查看合同（403 无法签署/作废由角色决定）', async () => {
    const list = await request(app.getHttpServer()).get('/api/contracts').set(auth(financeToken)).expect(200);
    expect((list.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);
  });

  it('作废草稿合同后不可签署', async () => {
    const anotherListing = agentOnSaleListings[1] ?? agentListing;
    const create = await request(app.getHttpServer())
      .post('/api/contracts')
      .set(auth(agentToken))
      .send({ listingId: anotherListing?.id, buyerCustomerId: secondBuyerCustomer?.id, sellerCustomerId: sellerCustomer?.id, templateId })
      .expect(201);
    const voidTarget = (create.body as Envelope<ContractDto>).data;

    const voided = await request(app.getHttpServer()).post(`/api/contracts/${voidTarget.id}/void`).set(auth(agentToken)).expect(201);
    expect((voided.body as Envelope<ContractDto>).data.signStatus).toBe('voided');

    const sign = await request(app.getHttpServer()).post(`/api/contracts/${voidTarget.id}/sign`).set(auth(agentToken)).expect(400);
    expect((sign.body as Envelope).code).toBe(42201);
  });
});

describe('交易进度', () => {
  it('进度时间轴：按序推进，跳节点被拒绝', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/contracts/${createdContractId}`).set(auth(agentToken)).expect(200);
    const contract = (detail.body as Envelope<ContractDto>).data;
    const loan = contract.progress.find((node) => node.nodeType === 'loan') as { id: string };

    const skip = await request(app.getHttpServer()).patch(`/api/progress/${loan.id}`).set(auth(agentToken)).send({ status: 'done' }).expect(400);
    expect((skip.body as Envelope).code).toBe(42201);

    const signNode = contract.progress.find((node) => node.nodeType === 'sign') as { id: string };
    const first = await request(app.getHttpServer()).patch(`/api/progress/${signNode.id}`).set(auth(agentToken)).send({ status: 'done' }).expect(200);
    expect((first.body as Envelope<{ status: string }>).data.status).toBe('done');

    const second = await request(app.getHttpServer()).patch(`/api/progress/${loan.id}`).set(auth(agentToken)).send({ status: 'doing' }).expect(200);
    expect((second.body as Envelope<{ status: string }>).data.status).toBe('doing');
  });

  it('进度节点通知买卖双方', async () => {
    const response = await request(app.getHttpServer()).post(`/api/progress/${createdContractId}`).set(auth(agentToken)).expect(404);
    expect((response.body as Envelope).code).toBe(40401); // 非节点 ID，用于验证路由与错误码

    const detail = await request(app.getHttpServer()).get(`/api/contracts/${createdContractId}`).set(auth(agentToken)).expect(200);
    const node = (detail.body as Envelope<ContractDto>).data.progress[0];
    const notify = await request(app.getHttpServer()).post(`/api/progress/${node.id}/notify`).set(auth(agentToken)).expect(201);
    expect((notify.body as Envelope<{ sent: number }>).data.sent).toBe(2);
  });

  it('买方查看合同详情与进度可见', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/contracts/${createdContractId}`).set(auth(buyerToken)).expect(200);
    const contract = (detail.body as Envelope<ContractDto>).data;
    expect(contract.signStatus).toBe('signed');
    expect(contract.progress.length).toBe(5);
  });

  it('无关经纪人访问合同 → 404', async () => {
    await request(app.getHttpServer()).get(`/api/contracts/${createdContractId}`).set(auth(agent2Token)).expect(404);
  });

  it('未登录访问合同接口 → 401', async () => {
    await request(app.getHttpServer()).get('/api/contracts').expect(401);
  });
});
