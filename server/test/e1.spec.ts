/**
 * E1 增强 API 验收：调价审批（发起/通过/驳回/权限/价格历史联动）、
 * 房源在线咨询（C 端留言/经纪人收件箱/回复）、重复房源提示、价格走势。
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

interface ListingDto {
  id: string;
  code: string;
  title: string;
  totalPrice: number;
  unitPrice: number;
  area: number;
  status: string;
}

interface ApprovalDto {
  id: string;
  code: string;
  status: string;
  listing: { id: string; totalPrice: number };
  payload: { oldTotalPrice: number; newTotalPrice: number };
  approver: { id: string; name: string } | null;
}

interface ConsultationDto {
  id: string;
  code: string;
  status: string;
  content: string;
  replyContent: string | null;
  listing: { id: string; title: string };
  fromUser: { id: string; name: string };
}

const PASSWORD = '123456';
let adminToken = '';
let managerToken = '';
let otherManagerToken = '';
let agentToken = '';
let agent2Token = '';
let buyerToken = '';

let targetListing: ListingDto | null = null;
let rejectListing: ListingDto | null = null;
let createdApprovalId = '';
let createdApprovalNewPrice = 0;
let createdConsultationId = '';

async function login(phone: string): Promise<LoginData> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone, password: PASSWORD }).expect(201);
  return (response.body as Envelope<LoginData>).data;
}

function auth(token: string, authToken = token): { Authorization: string } {
  return { Authorization: `Bearer ${authToken}` };
}

async function listAgentOnSale(token: string): Promise<ListingDto[]> {
  const response = await request(app.getHttpServer()).get('/api/listings').query({ status: 'on_sale', pageSize: 60 }).set(auth(token)).expect(200);
  return (response.body as Envelope<{ items: ListingDto[] }>).data.items;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  adminToken = (await login('13800000001')).token;
  managerToken = (await login('13800000003')).token;
  otherManagerToken = (await login('13800000004')).token;
  agentToken = (await login('13800000020')).token;
  agent2Token = (await login('13800000021')).token;
  buyerToken = (await login('13800000040')).token;

  const listings = await listAgentOnSale(agentToken);
  // 排除种子中已有待审批调价申请的房源（FC-901-000001），避免重复提交 409
  const candidates = listings.filter((item) => item.code !== 'FC-901-000001');
  targetListing = candidates[0] ?? listings[0] ?? null;
  rejectListing = candidates[1] ?? candidates[0] ?? null;
  expect(targetListing).toBeTruthy();
});

afterAll(async () => {
  await app.close();
});

describe('价格历史', () => {
  it('公开房源详情返回价格历史，最后一条等于当前挂牌价', async () => {
    const response = await request(app.getHttpServer()).get(`/api/public/listings/${targetListing?.id}`).expect(200);
    const data = (response.body as Envelope<{ totalPrice: number; priceHistory: Array<{ price: number; unitPrice: number; changedAt: string }> }>).data;
    expect(data.priceHistory.length).toBeGreaterThanOrEqual(3);
    expect(data.priceHistory[data.priceHistory.length - 1].price).toBe(data.totalPrice);
    expect(data.priceHistory.every((item) => item.unitPrice > 0)).toBe(true);
  });

  it('B 端房源详情同样返回价格历史', async () => {
    const response = await request(app.getHttpServer()).get(`/api/listings/${targetListing?.id}`).set(auth(agentToken)).expect(200);
    const data = (response.body as Envelope<{ priceHistory: unknown[] }>).data;
    expect(data.priceHistory.length).toBeGreaterThanOrEqual(3);
  });
});

describe('调价审批', () => {
  it('经纪人查看本人审批单（种子数据）', async () => {
    const response = await request(app.getHttpServer()).get('/api/approvals').set(auth(agentToken)).expect(200);
    const data = (response.body as Envelope<{ items: ApprovalDto[]; total: number }>).data;
    expect(data.total).toBeGreaterThanOrEqual(2);
    expect(data.items.every((item) => item.code.startsWith('AP'))).toBe(true);
  });

  it('店长只看到本店审批单，管理员看到全部', async () => {
    const manager = await request(app.getHttpServer()).get('/api/approvals').query({ pageSize: 60 }).set(auth(managerToken)).expect(200);
    const admin = await request(app.getHttpServer()).get('/api/approvals').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    const managerTotal = (manager.body as Envelope<{ total: number }>).data.total;
    const adminTotal = (admin.body as Envelope<{ total: number }>).data.total;
    expect(managerTotal).toBeGreaterThan(0);
    expect(adminTotal).toBeGreaterThanOrEqual(6);
    expect(managerTotal).toBeLessThan(adminTotal);
  });

  it('买方无权访问审批接口（403）', async () => {
    await request(app.getHttpServer()).get('/api/approvals').set(auth(buyerToken)).expect(403);
  });

  it('经纪人发起调价审批（待审批，通知店长）', async () => {
    createdApprovalNewPrice = Math.round(((targetListing?.totalPrice ?? 3000000) * 0.97) / 1000) * 1000;
    const response = await request(app.getHttpServer())
      .post('/api/approvals/price-change')
      .set(auth(agentToken))
      .send({ listingId: targetListing?.id, newTotalPrice: createdApprovalNewPrice, reason: 'E1 验收：客户议价，申请下调挂牌价' })
      .expect(201);
    const data = (response.body as Envelope<ApprovalDto>).data;
    createdApprovalId = data.id;
    expect(data.code).toMatch(/^AP\d{10}$/);
    expect(data.status).toBe('pending');
    expect(data.payload.oldTotalPrice).toBe(targetListing?.totalPrice);
    expect(data.payload.newTotalPrice).toBe(createdApprovalNewPrice);
  });

  it('同房源重复提交待审批调价 → 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/approvals/price-change')
      .set(auth(agentToken))
      .send({ listingId: targetListing?.id, newTotalPrice: createdApprovalNewPrice - 5000, reason: '重复提交' })
      .expect(400);
    expect((response.body as Envelope).code).toBe(40901);
  });

  it('非在售房源不可发起调价（42201）', async () => {
    const signed = await request(app.getHttpServer()).get('/api/listings').query({ status: 'signed', pageSize: 5 }).set(auth(agentToken)).expect(200);
    const listing = (signed.body as Envelope<{ items: ListingDto[] }>).data.items[0];
    const response = await request(app.getHttpServer())
      .post('/api/approvals/price-change')
      .set(auth(agentToken))
      .send({ listingId: listing.id, newTotalPrice: listing.totalPrice - 10000, reason: '已签约不可调价' })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('经纪人无权审批（403）', async () => {
    await request(app.getHttpServer()).post(`/api/approvals/${createdApprovalId}/approve`).set(auth(agentToken)).send({}).expect(403);
  });

  it('其他门店店长审批 → 404（数据范围隔离）', async () => {
    await request(app.getHttpServer()).post(`/api/approvals/${createdApprovalId}/approve`).set(auth(otherManagerToken)).send({}).expect(404);
  });

  it('店长通过调价：房源价格更新、写入价格历史、通知经纪人', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/approvals/${createdApprovalId}/approve`)
      .set(auth(managerToken))
      .send({ comment: '同意调价，请同步意向客户' })
      .expect(201);
    const approval = (response.body as Envelope<ApprovalDto>).data;
    expect(approval.status).toBe('approved');
    expect(approval.approver?.name).toContain('店长');

    const listing = await request(app.getHttpServer()).get(`/api/listings/${targetListing?.id}`).set(auth(agentToken)).expect(200);
    const listingData = (listing.body as Envelope<ListingDto & { priceHistory: Array<{ price: number; source: string }> }>).data;
    expect(listingData.totalPrice).toBe(createdApprovalNewPrice);
    const lastHistory = listingData.priceHistory[listingData.priceHistory.length - 1];
    expect(lastHistory.price).toBe(createdApprovalNewPrice);
    expect(lastHistory.source).toBe('approval');

    const notifications = await request(app.getHttpServer()).get('/api/notifications').set(auth(agentToken)).expect(200);
    const items = (notifications.body as Envelope<{ items: Array<{ title: string }> }>).data.items;
    expect(items.some((item) => item.title.includes('调价审批已通过'))).toBe(true);
  });

  it('已处理审批不可重复审批（42201）', async () => {
    const response = await request(app.getHttpServer()).post(`/api/approvals/${createdApprovalId}/approve`).set(auth(managerToken)).send({}).expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('驳回必须填写意见，驳回后房源价格不变', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/approvals/price-change')
      .set(auth(agentToken))
      .send({ listingId: rejectListing?.id, newTotalPrice: Math.round(((rejectListing?.totalPrice ?? 3000000) * 0.9) / 1000) * 1000, reason: 'E1 验收：申请大幅降价' })
      .expect(201);
    const approval = (create.body as Envelope<ApprovalDto>).data;
    const before = (await request(app.getHttpServer()).get(`/api/listings/${rejectListing?.id}`).set(auth(agentToken)).expect(200)).body as Envelope<ListingDto>;
    const beforePrice = before.data.totalPrice;

    const noComment = await request(app.getHttpServer()).post(`/api/approvals/${approval.id}/reject`).set(auth(managerToken)).send({}).expect(400);
    expect((noComment.body as Envelope).code).toBe(40001);

    const rejected = await request(app.getHttpServer())
      .post(`/api/approvals/${approval.id}/reject`)
      .set(auth(managerToken))
      .send({ comment: '降幅过大，请补充带看反馈' })
      .expect(201);
    expect((rejected.body as Envelope<ApprovalDto>).data.status).toBe('rejected');

    const after = (await request(app.getHttpServer()).get(`/api/listings/${rejectListing?.id}`).set(auth(agentToken)).expect(200)).body as Envelope<ListingDto>;
    expect(after.data.totalPrice).toBe(beforePrice);
  });
});

describe('房源在线咨询', () => {
  it('买方提交咨询 → 经纪人收件箱可见 → 回复 → 买方可见回复', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/public/listings/${targetListing?.id}`).expect(200);
    const detailData = (detail.body as Envelope<{ agent: { user: { name: string } } }>).data;
    expect(detailData.agent.user.name.length).toBeGreaterThan(0);

    const create = await request(app.getHttpServer())
      .post('/api/consultations')
      .set(auth(buyerToken))
      .send({ listingId: targetListing?.id, content: 'E1 验收：请问这套房源周末可以看房吗？' })
      .expect(201);
    const consultation = (create.body as Envelope<ConsultationDto>).data;
    createdConsultationId = consultation.id;
    expect(consultation.code).toMatch(/^ZX\d{10}$/);
    expect(consultation.status).toBe('pending');

    const my = await request(app.getHttpServer()).get('/api/consultations/my').set(auth(buyerToken)).expect(200);
    expect((my.body as Envelope<ConsultationDto[]>).data.some((item) => item.id === createdConsultationId)).toBe(true);

    const inbox = await request(app.getHttpServer()).get('/api/consultations/inbox').query({ pageSize: 60 }).set(auth(agentToken)).expect(200);
    const inboxData = (inbox.body as Envelope<{ items: ConsultationDto[]; pendingCount: number }>).data;
    expect(inboxData.items.some((item) => item.id === createdConsultationId)).toBe(true);
    expect(inboxData.pendingCount).toBeGreaterThan(0);

    const reply = await request(app.getHttpServer())
      .post(`/api/consultations/${createdConsultationId}/reply`)
      .set(auth(agentToken))
      .send({ content: '可以，周六上午 10 点方便安排看房。' })
      .expect(201);
    expect((reply.body as Envelope<ConsultationDto>).data.status).toBe('replied');

    const myAfter = await request(app.getHttpServer()).get('/api/consultations/my').set(auth(buyerToken)).expect(200);
    const replied = (myAfter.body as Envelope<ConsultationDto[]>).data.find((item) => item.id === createdConsultationId);
    expect(replied?.replyContent).toContain('周六上午');
  });

  it('重复回复 → 42201', async () => {
    const response = await request(app.getHttpServer()).post(`/api/consultations/${createdConsultationId}/reply`).set(auth(agentToken)).send({ content: '重复回复' }).expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('其他经纪人无权回复（403）', async () => {
    await request(app.getHttpServer()).post(`/api/consultations/${createdConsultationId}/reply`).set(auth(agent2Token)).send({ content: '越权回复' }).expect(403);
  });

  it('员工不能发起 C 端咨询（403）', async () => {
    await request(app.getHttpServer()).post('/api/consultations').set(auth(agentToken)).send({ listingId: targetListing?.id, content: '员工不能留言' }).expect(403);
  });

  it('内容过短 → 400', async () => {
    await request(app.getHttpServer()).post('/api/consultations').set(auth(buyerToken)).send({ listingId: targetListing?.id, content: '短' }).expect(400);
  });
});

describe('重复房源提示', () => {
  it('录入前查重：同小区同面积返回疑似重复房源', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/listings/${targetListing?.id}`).set(auth(agentToken)).expect(200);
    const listing = (detail.body as Envelope<ListingDto & { community: { id: string } }>).data;
    const response = await request(app.getHttpServer())
      .get('/api/listings/duplicate-check')
      .query({ communityId: listing.community.id, area: listing.area, rooms: 3, excludeId: listing.id })
      .set(auth(agentToken))
      .expect(200);
    const data = (response.body as Envelope<{ items: Array<{ id: string }> }>).data;
    expect(data.items.every((item) => item.id !== listing.id)).toBe(true);
  });

  it('无面积参数时返回空列表', async () => {
    const response = await request(app.getHttpServer()).get('/api/listings/duplicate-check').query({ communityId: targetListing?.id }).set(auth(agentToken)).expect(200);
    expect((response.body as Envelope<{ items: unknown[] }>).data.items).toHaveLength(0);
  });

  it('买方无权使用查重接口（403）', async () => {
    await request(app.getHttpServer()).get('/api/listings/duplicate-check').query({ communityId: 'x', area: 90 }).set(auth(buyerToken)).expect(403);
  });
});
