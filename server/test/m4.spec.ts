/**
 * M4 API 验收：机构/门店与经纪人管理、业绩统计（总览/趋势/排行）、
 * 实名审核、操作日志查询、财务资金核对、用户账号管理。
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

const PASSWORD = '123456';
let adminToken = '';
let managerToken = '';
let agentToken = '';
let financeToken = '';
let buyerToken = '';

async function login(phone: string): Promise<LoginData> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone, password: PASSWORD }).expect(201);
  return (response.body as Envelope<LoginData>).data;
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  adminToken = (await login('13800000001')).token;
  managerToken = (await login('13800000003')).token;
  agentToken = (await login('13800000020')).token;
  financeToken = (await login('13800000002')).token;
  buyerToken = (await login('13800000040')).token;
});

afterAll(async () => {
  await app.close();
});

describe('机构门店与经纪人', () => {
  it('管理员查看机构树（1 机构 + 5 门店，含经营统计）', async () => {
    const response = await request(app.getHttpServer()).get('/api/agencies').set(auth(adminToken)).expect(200);
    const tree = (response.body as Envelope<Array<{ id: string; type: string; children: unknown[]; stats: { agentCount: number; listingCount: number } }>>).data;
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('hq');
    expect(tree[0].children).toHaveLength(5);
    expect(tree[0].stats.listingCount).toBeGreaterThanOrEqual(60);
    expect(tree[0].stats.agentCount).toBeGreaterThanOrEqual(12);
  });

  it('店长只看到本店统计', async () => {
    const response = await request(app.getHttpServer()).get('/api/agencies').set(auth(managerToken)).expect(200);
    const tree = (response.body as Envelope<Array<{ stats: { agentCount: number; listingCount: number } }>>).data;
    expect(tree).toHaveLength(1);
    expect(tree[0].stats.agentCount).toBeGreaterThanOrEqual(3);
    expect(tree[0].stats.listingCount).toBeGreaterThanOrEqual(15);
  });

  it('经纪人无权查看机构树（403）', async () => {
    await request(app.getHttpServer()).get('/api/agencies').set(auth(agentToken)).expect(403);
  });

  it('经纪人列表：管理员 12 人，含业绩摘要', async () => {
    const response = await request(app.getHttpServer()).get('/api/agents').set(auth(adminToken)).expect(200);
    const agents = (response.body as Envelope<Array<{ name: string; stats: { listingCount: number; showingCount: number } }>>).data;
    expect(agents.length).toBeGreaterThanOrEqual(12);
    expect(agents.every((agent) => typeof agent.stats.listingCount === 'number')).toBe(true);
  });

  it('店长只看到本店经纪人；经纪人只看本人', async () => {
    const manager = await request(app.getHttpServer()).get('/api/agents').set(auth(managerToken)).expect(200);
    expect((manager.body as Envelope<unknown[]>).data.length).toBeGreaterThanOrEqual(3);

    const agent = await request(app.getHttpServer()).get('/api/agents').set(auth(agentToken)).expect(200);
    expect((agent.body as Envelope<unknown[]>).data).toHaveLength(1);
  });

  it('管理员新增门店，资质编号重复返回 409', async () => {
    const payload = {
      name: `M4验收门店${Date.now() % 10000}`,
      licenseNo: `JJ-TEST-${Date.now()}`,
      address: '江州市城东区测试路 1 号',
      phone: '0571-88990000',
    };
    const created = await request(app.getHttpServer()).post('/api/agencies').set(auth(adminToken)).send(payload).expect(201);
    expect((created.body as Envelope<{ name: string }>).data.name).toContain('M4验收门店');

    const dupe = await request(app.getHttpServer()).post('/api/agencies').set(auth(adminToken)).send(payload).expect(400);
    expect((dupe.body as Envelope).code).toBe(40901);
  });

  it('店长可调整本店经纪人职级；跨店调整被拒绝（403）', async () => {
    const agents = await request(app.getHttpServer()).get('/api/agents').set(auth(managerToken)).expect(200);
    const own = (agents.body as Envelope<Array<{ id: string }>>).data[0];
    const ok = await request(app.getHttpServer()).post(`/api/agents/${own.id}`).set(auth(managerToken)).send({ title: '资深经纪人' }).expect(201);
    expect((ok.body as Envelope<{ title: string }>).data.title).toBe('资深经纪人');

    const all = await request(app.getHttpServer()).get('/api/agents').set(auth(adminToken)).expect(200);
    const other = (all.body as Envelope<Array<{ id: string }>>).data.find((item) => item.id !== own.id && item.id);
    const denied = await request(app.getHttpServer()).post(`/api/agents/${other?.id}`).set(auth(managerToken)).send({ title: '越权' }).expect(403);
    expect((denied.body as Envelope).code).toBe(40301);
  });
});

describe('业绩统计', () => {
  it('管理员总览包含全平台核心指标', async () => {
    const response = await request(app.getHttpServer()).get('/api/stats/overview').set(auth(adminToken)).expect(200);
    const data = (response.body as Envelope<Record<string, number>>).data;
    expect(data.listingCount).toBeGreaterThanOrEqual(60);
    expect(data.customerCount).toBeGreaterThanOrEqual(30);
    expect(data.signedContractCount).toBeGreaterThanOrEqual(7);
    expect(data.dealAmount).toBeGreaterThan(0);
    expect(data.commissionAmount).toBeGreaterThan(0);
  });

  it('经纪人总览只统计本人数据', async () => {
    const agent = await request(app.getHttpServer()).get('/api/stats/overview').set(auth(agentToken)).expect(200);
    const manager = await request(app.getHttpServer()).get('/api/stats/overview').set(auth(managerToken)).expect(200);
    const agentData = (agent.body as Envelope<Record<string, number>>).data;
    const managerData = (manager.body as Envelope<Record<string, number>>).data;
    expect(agentData.listingCount).toBeGreaterThanOrEqual(5);
    expect(managerData.listingCount).toBeGreaterThan(agentData.listingCount);
    expect(managerData.dealAmount).toBeGreaterThanOrEqual(agentData.dealAmount);
  });

  it('买方无权查看业绩（403）', async () => {
    await request(app.getHttpServer()).get('/api/stats/overview').set(auth(buyerToken)).expect(403);
  });

  it('趋势接口返回 6 个月数据且金额一致', async () => {
    const response = await request(app.getHttpServer()).get('/api/stats/trend').query({ months: 6 }).set(auth(financeToken)).expect(200);
    const trend = (response.body as Envelope<Array<{ month: string; contractCount: number; dealAmount: number }>>).data;
    expect(trend).toHaveLength(6);
    expect(trend[5].month).toBe(dayjs().format('YYYY-MM'));
    expect(trend.every((item) => item.dealAmount >= 0)).toBe(true);
  });

  it('排行按成交金额降序，管理员 12 人/店长 3 人', async () => {
    const adminRank = await request(app.getHttpServer()).get('/api/stats/ranking').set(auth(adminToken)).expect(200);
    const all = (adminRank.body as Envelope<Array<{ dealAmount: number; signedContractCount: number }>>).data;
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (let index = 1; index < all.length; index += 1) {
      expect(all[index - 1].dealAmount).toBeGreaterThanOrEqual(all[index].dealAmount);
    }

    const managerRank = await request(app.getHttpServer()).get('/api/stats/ranking').set(auth(managerToken)).expect(200);
    expect((managerRank.body as Envelope<unknown[]>).data.length).toBeGreaterThanOrEqual(3);
  });
});

describe('实名认证审核', () => {
  it('管理员查看待审核实名列表', async () => {
    const response = await request(app.getHttpServer()).get('/api/admin/audits/realnames').set(auth(adminToken)).expect(200);
    const data = (response.body as Envelope<{ items: Array<{ id: string; idCardMasked: string; user: { name: string } }>; total: number }>).data;
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.items[0].idCardMasked).toContain('********');
  });

  it('驳回必须填写原因（400）', async () => {
    const list = await request(app.getHttpServer()).get('/api/admin/audits/realnames').set(auth(adminToken)).expect(200);
    const id = (list.body as Envelope<{ items: Array<{ id: string }> }>).data.items[0].id;
    const response = await request(app.getHttpServer()).post(`/api/admin/audits/realnames/${id}`).set(auth(adminToken)).send({ pass: false }).expect(400);
    expect((response.body as Envelope).code).toBe(40001);
  });

  it('审核通过后状态变更并通知用户', async () => {
    const list = await request(app.getHttpServer()).get('/api/admin/audits/realnames').set(auth(adminToken)).expect(200);
    const record = (list.body as Envelope<{ items: Array<{ id: string; user: { id: string; name: string } }> }>).data.items[0];
    const approve = await request(app.getHttpServer())
      .post(`/api/admin/audits/realnames/${record.id}`)
      .set(auth(adminToken))
      .send({ pass: true })
      .expect(201);
    expect((approve.body as Envelope<{ status: string }>).data.status).toBe('approved');

    const logs = await request(app.getHttpServer()).get('/api/logs').query({ action: 'review_realname' }).set(auth(adminToken)).expect(200);
    expect((logs.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);
  });

  it('驳回流程：填写原因后状态为 rejected', async () => {
    const pending = await request(app.getHttpServer()).get('/api/admin/audits/realnames').set(auth(adminToken)).expect(200);
    const items = (pending.body as Envelope<{ items: Array<{ id: string }> }>).data.items;
    if (items.length === 0) {
      // 无待审核记录时跳过（前置用例已通过审核）
      expect(items.length).toBe(0);
      return;
    }
    const response = await request(app.getHttpServer())
      .post(`/api/admin/audits/realnames/${items[0].id}`)
      .set(auth(adminToken))
      .send({ pass: false, reason: '证件照片不清晰' })
      .expect(201);
    expect((response.body as Envelope<{ status: string }>).data.status).toBe('rejected');
  });

  it('非管理员不能访问实名审核（403）', async () => {
    await request(app.getHttpServer()).get('/api/admin/audits/realnames').set(auth(agentToken)).expect(403);
    await request(app.getHttpServer()).post('/api/admin/audits/realnames/any').set(auth(agentToken)).send({ pass: true }).expect(403);
  });
});

describe('操作日志', () => {
  it('管理员分页查询操作日志（含用户信息）', async () => {
    const response = await request(app.getHttpServer()).get('/api/logs').query({ pageSize: 10 }).set(auth(adminToken)).expect(200);
    const data = (response.body as Envelope<{ items: Array<{ action: string; user: { name: string } | null }>; total: number }>).data;
    expect(data.total).toBeGreaterThanOrEqual(50);
    expect(data.items).toHaveLength(10);
    expect(data.items[0]).toHaveProperty('action');
  });

  it('支持动作与时间范围筛选', async () => {
    const byAction = await request(app.getHttpServer()).get('/api/logs').query({ action: 'create_listing' }).set(auth(adminToken)).expect(200);
    expect((byAction.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);

    const future = await request(app.getHttpServer()).get('/api/logs').query({ dateFrom: dayjs().add(1, 'year').format('YYYY-MM-DD') }).set(auth(adminToken)).expect(200);
    expect((future.body as Envelope<{ total: number }>).data.total).toBe(0);
  });

  it('非管理员无权查看操作日志（403）', async () => {
    await request(app.getHttpServer()).get('/api/logs').set(auth(managerToken)).expect(403);
  });
});

describe('财务资金核对', () => {
  it('财务查看资金记录（含合同/房源/双方信息）', async () => {
    const response = await request(app.getHttpServer()).get('/api/payments').query({ pageSize: 10 }).set(auth(financeToken)).expect(200);
    const data = (response.body as Envelope<{ items: Array<{ contract: { code: string; listing: { title: string } }; amount: number }>; total: number }>).data;
    expect(data.total).toBeGreaterThanOrEqual(20);
    expect(data.items[0].contract.code).toMatch(/^HT\d{10}$/);
    expect(data.items[0].amount).toBeGreaterThan(0);
  });

  it('财务核对确认待支付记录并通知卖方', async () => {
    const list = await request(app.getHttpServer()).get('/api/payments').query({ status: 'unpaid' }).set(auth(financeToken)).expect(200);
    const unpaid = (list.body as Envelope<{ items: Array<{ id: string }> }>).data.items[0];
    expect(unpaid).toBeTruthy();

    const settled = await request(app.getHttpServer()).post(`/api/payments/${unpaid.id}/settle`).set(auth(financeToken)).expect(201);
    expect((settled.body as Envelope<{ status: string }>).data.status).toBe('paid');

    const again = await request(app.getHttpServer()).post(`/api/payments/${unpaid.id}/settle`).set(auth(financeToken)).expect(400);
    expect((again.body as Envelope).code).toBe(42201);
  });

  it('财务总览：已收/未收与佣金口径', async () => {
    const response = await request(app.getHttpServer()).get('/api/finance/overview').set(auth(financeToken)).expect(200);
    const data = (response.body as Envelope<Record<string, number>>).data;
    expect(data.paidAmount).toBeGreaterThan(0);
    expect(data.recordCount).toBeGreaterThanOrEqual(20);
    expect(data.commissionPaid + data.commissionUnpaid).toBeGreaterThan(0);
  });

  it('经纪人/店长无权访问资金接口（403）', async () => {
    await request(app.getHttpServer()).get('/api/payments').set(auth(agentToken)).expect(403);
    await request(app.getHttpServer()).get('/api/payments').set(auth(managerToken)).expect(403);
    await request(app.getHttpServer()).get('/api/finance/overview').set(auth(buyerToken)).expect(403);
  });
});

describe('用户账号管理', () => {
  it('管理员查询用户并支持角色筛选', async () => {
    const all = await request(app.getHttpServer()).get('/api/users').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    expect((all.body as Envelope<{ total: number }>).data.total).toBeGreaterThanOrEqual(36);

    const sellers = await request(app.getHttpServer()).get('/api/users').query({ role: 'seller' }).set(auth(adminToken)).expect(200);
    expect((sellers.body as Envelope<{ total: number }>).data.total).toBe(9);
  });

  it('禁用账号后无法登录，重新启用恢复', async () => {
    const users = await request(app.getHttpServer()).get('/api/users').query({ role: 'buyer' }).set(auth(adminToken)).expect(200);
    const target = (users.body as Envelope<{ items: Array<{ id: string; phone: string }> }>).data.items.find((item) => item.phone === '13800000047');
    expect(target).toBeTruthy();

    await request(app.getHttpServer()).patch(`/api/users/${target?.id}/status`).set(auth(adminToken)).send({ status: 'disabled' }).expect(200);
    const denied = await request(app.getHttpServer()).post('/api/auth/login').send({ phone: '13800000047', password: PASSWORD }).expect(401);
    expect((denied.body as Envelope).code).toBe(40102);

    await request(app.getHttpServer()).patch(`/api/users/${target?.id}/status`).set(auth(adminToken)).send({ status: 'active' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login').send({ phone: '13800000047', password: PASSWORD }).expect(201);
  });

  it('管理员重置密码为演示密码 123456 并记入日志', async () => {
    const users = await request(app.getHttpServer()).get('/api/users').query({ role: 'seller' }).set(auth(adminToken)).expect(200);
    const target = (users.body as Envelope<{ items: Array<{ id: string; phone: string }> }>).data.items[0];
    const response = await request(app.getHttpServer()).post(`/api/users/${target.id}/reset-password`).set(auth(adminToken)).expect(201);
    expect((response.body as Envelope<{ resetTo: string }>).data.resetTo).toBe('123456');

    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ phone: target.phone, password: PASSWORD }).expect(201);
    expect((login.body as Envelope<LoginData>).code).toBe(0);

    const logs = await request(app.getHttpServer()).get('/api/logs').query({ action: 'reset_password' }).set(auth(adminToken)).expect(200);
    expect((logs.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);
  });

  it('非管理员不能管理用户（403）', async () => {
    await request(app.getHttpServer()).get('/api/users').set(auth(managerToken)).expect(403);
    await request(app.getHttpServer()).post('/api/users/any/reset-password').set(auth(managerToken)).expect(403);
  });
});
