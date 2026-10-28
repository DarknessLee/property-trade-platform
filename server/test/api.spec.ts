/**
 * M1 API 验收：健康检查、登录、鉴权、公开浏览、字典、通知、实名、错误码与权限拒绝。
 * 前置：npm run db:reset（种子数据已就绪，测试读取 dev.db）。
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
  user: { id: string; name: string; role: string; roleLabel: string; phone: string };
}

const DEMO_PASSWORD = '123456';

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
function makeValidId(base17: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(base17[i]) * ID_WEIGHTS[i];
  return `${base17}${ID_CHECK[sum % 11]}`;
}

async function login(phone: string, password = DEMO_PASSWORD): Promise<LoginData> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone, password }).expect(201);
  return (response.body as Envelope<LoginData>).data;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('健康检查与公开接口', () => {
  it('GET /api/health 返回应用信息', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    const body = response.body as Envelope<{ status: string; version: string; app: string }>;
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('ok');
    expect(body.data.version).toBe('V1.0');
    expect(body.data.app).toContain('房产交易');
  });

  it('GET /api/public/home 统计与种子一致', async () => {
    const response = await request(app.getHttpServer()).get('/api/public/home').expect(200);
    const body = response.body as Envelope<{ onSaleListings: number; communities: number; signedContracts: number; agencies: number; agents: number }>;
    // 在售 + 已签约恒为 47 套（签约只改状态）；小区可能因 M2 用例新增，故取下限
    expect(body.data.onSaleListings + body.data.signedContracts).toBe(47);
    expect(body.data.communities).toBeGreaterThanOrEqual(15);
    expect(body.data.agencies).toBeGreaterThanOrEqual(6);
    expect(body.data.agents).toBe(12);
  });

  it('GET /api/public/listings 支持区域筛选与分页', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/listings')
      .query({ district: '城东区', pageSize: 5 })
      .expect(200);
    const body = response.body as Envelope<{ items: Array<{ community: { district: string } }>; total: number; pageSize: number }>;
    expect(body.code).toBe(0);
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items.length).toBeLessThanOrEqual(5);
    for (const item of body.data.items) {
      expect(item.community.district).toBe('城东区');
    }
    expect(body.data.total).toBeGreaterThanOrEqual(body.data.items.length);
  });

  it('GET /api/public/listings/:id 返回详情且包含经纪人', async () => {
    const list = await request(app.getHttpServer()).get('/api/public/listings').query({ pageSize: 1 }).expect(200);
    const first = (list.body as Envelope<{ items: Array<{ id: string; title: string }> }>).data.items[0];
    const response = await request(app.getHttpServer()).get(`/api/public/listings/${first.id}`).expect(200);
    const detail = (response.body as Envelope<{ title: string; images: unknown[]; agent: { user: { name: string } } }>).data;
    expect(detail.title).toBe(first.title);
    expect(detail.images.length).toBeGreaterThan(0);
    expect(detail.agent.user.name.length).toBeGreaterThan(0);
  });

  it('GET /api/public/listings/:id 不存在时返回 40401', async () => {
    const response = await request(app.getHttpServer()).get('/api/public/listings/not-exist').expect(404);
    expect((response.body as Envelope).code).toBe(40401);
  });

  it('GET /api/dicts/grouped 返回角色与户型字典', async () => {
    const response = await request(app.getHttpServer()).get('/api/dicts/grouped').expect(200);
    const data = (response.body as Envelope<Record<string, unknown[]>>).data;
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['role', 'orientation', 'decoration', 'sign_status']));
    expect(data.role.length).toBe(6);
  });
});

describe('认证与鉴权', () => {
  it('六个角色均可登录，返回角色标签', async () => {
    const cases: Array<[string, string, string]> = [
      ['13800000001', 'admin', '平台管理员'],
      ['13800000002', 'finance', '财务'],
      ['13800000003', 'store_manager', '店长'],
      ['13800000020', 'agent', '经纪人'],
      ['13800000040', 'buyer', '买方'],
      ['13800000060', 'seller', '卖方'],
    ];
    for (const [phone, role, label] of cases) {
      const data = await login(phone);
      expect(data.user.role).toBe(role);
      expect(data.user.roleLabel).toBe(label);
      expect(data.token.split('.')).toHaveLength(3);
    }
  });

  it('密码错误返回 401 + 40102', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '13800000040', password: 'wrong-password' })
      .expect(401);
    expect((response.body as Envelope).code).toBe(40102);
  });

  it('手机号格式错误返回 400 + 40001', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone: '123', password: '123456' }).expect(400);
    expect((response.body as Envelope).code).toBe(40001);
  });

  it('未登录访问 /auth/me 返回 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect((response.body as Envelope).code).toBe(40101);
  });

  it('携带 token 访问 /auth/me 返回本人信息', async () => {
    const { token, user } = await login('13800000020');
    const response = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    const me = (response.body as Envelope<{ id: string; name: string; agencyName: string | null }>).data;
    expect(me.id).toBe(user.id);
    expect(me.name).toBe(user.name);
    expect(me.agencyName).toContain('安家地产');
  });

  it('伪造 token 返回 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer forged.token.value')
      .expect(401);
    expect((response.body as Envelope).code).toBe(40101);
  });

  it('验证码登录：固定演示码 123456 成功，错误码失败', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/auth/login/code')
      .send({ phone: '13800000040', code: '123456' })
      .expect(201);
    expect((ok.body as Envelope<LoginData>).code).toBe(0);
    const fail = await request(app.getHttpServer())
      .post('/api/auth/login/code')
      .send({ phone: '13800000040', code: '654321' })
      .expect(401);
    expect((fail.body as Envelope).code).toBe(40102);
  });
});

describe('实名认证（Mock）', () => {
  it('校验位合法的证件提交后进入 pending', async () => {
    const { token } = await login('13800000041');
    const idCard = makeValidId('11010119900307001');
    const response = await request(app.getHttpServer())
      .post('/api/auth/realname')
      .set('Authorization', `Bearer ${token}`)
      .send({ realName: '刘芳', idCard })
      .expect(201);
    expect((response.body as Envelope<{ status: string }>).data.status).toBe('pending');

    const status = await request(app.getHttpServer())
      .get('/api/auth/realname')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const data = (status.body as Envelope<{ status: string; idCardMasked: string }>).data;
    expect(data.status).toBe('pending');
    expect(data.idCardMasked).toContain('********');
  });

  it('校验位错误返回 400', async () => {
    const { token } = await login('13800000042');
    const response = await request(app.getHttpServer())
      .post('/api/auth/realname')
      .set('Authorization', `Bearer ${token}`)
      .send({ realName: '黄磊', idCard: '110101199003070010' })
      .expect(400);
    expect((response.body as Envelope).code).toBe(40001);
  });

  it('未登录不能提交实名', async () => {
    await request(app.getHttpServer()).post('/api/auth/realname').send({ realName: 'x', idCard: '11010119900307001X' }).expect(401);
  });
});

describe('通知（登录后可见本人数据）', () => {
  it('登录用户可读取通知并标记已读', async () => {
    const { token } = await login('13800000040');
    const list = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const data = (list.body as Envelope<{ items: unknown[]; unreadCount: number }>).data;
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.unreadCount).toBeGreaterThanOrEqual(0);

    const readAll = await request(app.getHttpServer())
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect((readAll.body as Envelope<{ updated: number }>).code).toBe(0);
  });

  it('未登录访问通知返回 401', async () => {
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
  });
});
