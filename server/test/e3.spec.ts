/**
 * E3 增强 API 验收：看板深化（挂牌价走势/区域下钻）与可配置佣金规则/审批流配置。
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
interface MarketRow {
  district: string;
  onSaleCount: number;
  avgUnitPrice: number;
  communities: Array<{ name: string; onSaleCount: number; avgUnitPrice: number }>;
}
interface TrendPoint {
  month: string;
  avgUnitPrice: number;
  listingCount: number;
}

const PASSWORD = '123456';
let adminToken = '';
let agentToken = '';
let buyerToken = '';

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
  agentToken = (await login('13800000020')).token;
  buyerToken = (await login('13800000040')).token;
});

afterAll(async () => {
  await app.close();
});

describe('看板深化', () => {
  it('挂牌价走势：近 6 个月均价与样本量（可按行政区过滤）', async () => {
    const all = await request(app.getHttpServer()).get('/api/stats/price-trend').query({ months: 6 }).set(auth(adminToken)).expect(200);
    const points = (all.body as Envelope<TrendPoint[]>).data;
    expect(points).toHaveLength(6);
    expect(points.every((item) => item.avgUnitPrice > 0 && item.listingCount > 0)).toBe(true);

    const district = await request(app.getHttpServer()).get('/api/stats/price-trend').query({ district: '城东区', months: 6 }).set(auth(adminToken)).expect(200);
    const districtPoints = (district.body as Envelope<TrendPoint[]>).data;
    expect(districtPoints).toHaveLength(6);
    expect(districtPoints.every((item) => item.avgUnitPrice > 0)).toBe(true);
  });

  it('区域行情包含小区下钻数据，小区在售合计=区域在售', async () => {
    const response = await request(app.getHttpServer()).get('/api/stats/market').set(auth(adminToken)).expect(200);
    const market = (response.body as Envelope<MarketRow[]>).data;
    expect(market.length).toBeGreaterThanOrEqual(5);
    for (const row of market) {
      expect(row.communities.length).toBeGreaterThan(0);
      expect(row.communities.reduce((sum, item) => sum + item.onSaleCount, 0)).toBe(row.onSaleCount);
      expect(row.communities.every((item) => item.avgUnitPrice > 0)).toBe(true);
    }
  });

  it('买方无权访问看板接口（403）', async () => {
    await request(app.getHttpServer()).get('/api/stats/price-trend').set(auth(buyerToken)).expect(403);
  });
});

describe('佣金规则配置', () => {
  it('读取规则：四角色比例合计 100%', async () => {
    const response = await request(app.getHttpServer()).get('/api/commissions/rules').set(auth(adminToken)).expect(200);
    const rule = (response.body as Envelope<{ rates: { agentRate: number; coAgentRate: number; storeRate: number; platformRate: number } }>).data;
    const sum = rule.rates.agentRate + rule.rates.coAgentRate + rule.rates.storeRate + rule.rates.platformRate;
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });

  it('经纪人无权修改规则（403），比例合计不为 100% 拒绝（42201）', async () => {
    await request(app.getHttpServer()).put('/api/commissions/rules').set(auth(agentToken)).send({ agentRate: 0.5, coAgentRate: 0.2, storeRate: 0.2, platformRate: 0.1 }).expect(403);
    const response = await request(app.getHttpServer())
      .put('/api/commissions/rules')
      .set(auth(adminToken))
      .send({ agentRate: 0.5, coAgentRate: 0.2, storeRate: 0.2, platformRate: 0.2 })
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('管理员可修改规则并持久化，历史结算分摊不变', async () => {
    const before = await request(app.getHttpServer()).get('/api/commissions').query({ pageSize: 1 }).set(auth(adminToken)).expect(200);
    const beforeAllocation = (before.body as Envelope<{ items: Array<{ allocations: Array<{ amount: number }>; totalCommission: number }> }>).data.items[0];

    const updated = await request(app.getHttpServer())
      .put('/api/commissions/rules')
      .set(auth(adminToken))
      .send({ agentRate: 0.55, coAgentRate: 0.2, storeRate: 0.2, platformRate: 0.05 })
      .expect(200);
    expect((updated.body as Envelope<{ rates: { agentRate: number } }>).data.rates.agentRate).toBeCloseTo(0.55, 5);

    const readBack = await request(app.getHttpServer()).get('/api/commissions/rules').set(auth(adminToken)).expect(200);
    expect((readBack.body as Envelope<{ rates: { coAgentRate: number } }>).data.rates.coAgentRate).toBeCloseTo(0.2, 5);

    const after = await request(app.getHttpServer()).get('/api/commissions').query({ pageSize: 1 }).set(auth(adminToken)).expect(200);
    const afterAllocation = (after.body as Envelope<{ items: Array<{ allocations: Array<{ amount: number }>; totalCommission: number }> }>).data.items[0];
    expect(afterAllocation.allocations.reduce((sum, item) => sum + item.amount, 0)).toBe(afterAllocation.totalCommission);
    expect(afterAllocation.allocations.map((item) => item.amount)).toEqual(beforeAllocation.allocations.map((item) => item.amount));

    // 恢复默认规则，避免影响其它用例
    await request(app.getHttpServer())
      .put('/api/commissions/rules')
      .set(auth(adminToken))
      .send({ agentRate: 0.6, coAgentRate: 0.15, storeRate: 0.2, platformRate: 0.05 })
      .expect(200);
  });
});

describe('审批流配置', () => {
  it('读取配置包含调价审批类型；经纪人不可修改（403）', async () => {
    const response = await request(app.getHttpServer()).get('/api/approvals/config').set(auth(adminToken)).expect(200);
    const configs = (response.body as Envelope<Array<{ type: string; mode: string }>>).data;
    expect(configs.some((item) => item.type === 'price_change')).toBe(true);
    expect(configs.every((item) => ['single', 'two_level'].includes(item.mode))).toBe(true);

    await request(app.getHttpServer()).put('/api/approvals/config').set(auth(agentToken)).send({ type: 'price_change', mode: 'two_level' }).expect(403);
  });

  it('管理员可切换非调价类型审批模式并持久化', async () => {
    const toTwo = await request(app.getHttpServer()).put('/api/approvals/config').set(auth(adminToken)).send({ type: 'contract_void', mode: 'two_level' }).expect(200);
    expect((toTwo.body as Envelope<{ mode: string }>).data.mode).toBe('two_level');
    const readBack = await request(app.getHttpServer()).get('/api/approvals/config').set(auth(adminToken)).expect(200);
    expect((readBack.body as Envelope<Array<{ type: string; mode: string }>>).data.find((item) => item.type === 'contract_void')?.mode).toBe('two_level');
    await request(app.getHttpServer()).put('/api/approvals/config').set(auth(adminToken)).send({ type: 'contract_void', mode: 'single' }).expect(200);
  });

  it('非法模式参数 400', async () => {
    await request(app.getHttpServer()).put('/api/approvals/config').set(auth(adminToken)).send({ type: 'price_change', mode: 'bad' }).expect(400);
  });
});
