/**
 * 权限回归：菜单可见 ↔ 接口可用 一致性（修复 403 后固化）。
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

const PASSWORD = '123456';
let agentToken = '';
let sellerToken = '';
let financeToken = '';
let contractId = '';

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
  agentToken = (await login('13800000020')).token;
  sellerToken = (await login('13800000060')).token;
  financeToken = (await login('13800000002')).token;
  const contracts = await request(app.getHttpServer()).get('/api/contracts').query({ pageSize: 20 }).set(auth(financeToken)).expect(200);
  contractId = (contracts.body as Envelope<{ items: Array<{ id: string }> }>).data.items[0]?.id ?? '';
});

afterAll(async () => {
  await app.close();
});

describe('菜单可见 ↔ 接口可用', () => {
  it('经纪人可见「资金监管」菜单，概览接口应 200 且按本人数据范围统计', async () => {
    const overview = await request(app.getHttpServer()).get('/api/escrows/overview').set(auth(agentToken)).expect(200);
    const data = (overview.body as Envelope<{ accountCount: number; totalAmount: number }>).data;
    expect(typeof data.accountCount).toBe('number');
    expect(data.accountCount).toBeGreaterThanOrEqual(0);
    await request(app.getHttpServer()).get('/api/escrows').query({ pageSize: 10 }).set(auth(agentToken)).expect(200);
  });

  it('卖方账号不开放预约看房：带看接口按设计返回 403（前端已隐藏入口并跳过请求）', async () => {
    await request(app.getHttpServer()).get('/api/showings/my').set(auth(sellerToken)).expect(403);
  });

  it('财务可见「合同签约/交易进度」菜单，但写操作按后端策略拒绝（403，前端已隐藏入口）', async () => {
    if (contractId) {
      await request(app.getHttpServer()).post(`/api/contracts/${contractId}/sign`).set(auth(financeToken)).send({}).expect(403);
    }
    const progress = await request(app.getHttpServer()).get('/api/contracts').query({ pageSize: 10 }).set(auth(financeToken)).expect(200);
    const first = (progress.body as Envelope<{ items: Array<{ id: string; progress?: Array<{ id: string }> }> }>).data.items[0];
    if (first?.progress?.[0]) {
      await request(app.getHttpServer()).patch(`/api/progress/${first.progress[0].id}`).set(auth(financeToken)).send({ status: 'doing' }).expect(403);
    }
  });

  it('卖方无权发起 C 端带看（403）', async () => {
    const listings = await request(app.getHttpServer()).get('/api/public/listings').query({ pageSize: 1 }).expect(200);
    const listing = (listings.body as Envelope<{ items: Array<{ id: string }> }>).data.items[0];
    await request(app.getHttpServer())
      .post('/api/showings/my')
      .set(auth(sellerToken))
      .send({ listingId: listing.id, scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(), durationMin: 30 })
      .expect(403);
  });
});
