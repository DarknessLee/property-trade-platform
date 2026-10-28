/**
 * M2 API 验收：房源 CRUD/状态机/权限、小区字典、附件上传、公开地图与价格参考。
 * 前置：npm run db:reset（种子数据就绪）。
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
  user: { id: string; name: string; role: string; agencyId: string | null };
}

interface ListingDto {
  id: string;
  code: string;
  title: string;
  status: string;
  verifyStatus: string;
  agency: { id: string };
  agent: { id: string };
  owner: { id: string };
  community: { id: string };
  listedAt: string | null;
  totalPrice: number;
  unitPrice: number;
  area: number;
}

const PASSWORD = '123456';
let agentToken = '';
let agent2Token = '';
let managerToken = '';
let adminToken = '';
let buyerToken = '';
let createdListingId = '';
let createdListingCode = '';
let createdCommunityId = '';
const uniqueSuffix = Date.now();

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

  const agent = await login('13800000020');
  agentToken = agent.token;
  const agent2 = await login('13800000021');
  agent2Token = agent2.token;
  const manager = await login('13800000003');
  managerToken = manager.token;
  const admin = await login('13800000001');
  adminToken = admin.token;
  const buyer = await login('13800000040');
  buyerToken = buyer.token;
});

afterAll(async () => {
  await app.close();
});

describe('房源列表与数据范围', () => {
  it('未登录访问房源列表返回 401', async () => {
    await request(app.getHttpServer()).get('/api/listings').expect(401);
  });

  it('买方访问 B 端房源列表返回 403', async () => {
    const response = await request(app.getHttpServer()).get('/api/listings').set(auth(buyerToken)).expect(403);
    expect((response.body as Envelope).code).toBe(40301);
  });

  it('经纪人只看到自己维护的房源', async () => {
    const response = await request(app.getHttpServer()).get('/api/listings').set(auth(agentToken)).expect(200);
    const data = (response.body as Envelope<{ items: ListingDto[]; total: number }>).data;
    expect(data.total).toBe(5);
    const agentIds = new Set(data.items.map((item) => item.agent.id));
    expect(agentIds.size).toBe(1);
  });

  it('店长看到本店房源（范围大于单个经纪人）', async () => {
    const agentList = await request(app.getHttpServer()).get('/api/listings').set(auth(agentToken)).expect(200);
    const agentTotal = (agentList.body as Envelope<{ total: number }>).data.total;

    const response = await request(app.getHttpServer()).get('/api/listings').set(auth(managerToken)).expect(200);
    const data = (response.body as Envelope<{ items: ListingDto[]; total: number }>).data;
    expect(data.total).toBeGreaterThan(agentTotal);
    const agencyIds = new Set(data.items.map((item) => item.agency.id));
    expect(agencyIds.size).toBe(1);
  });

  it('管理员看到全部 60 套房源', async () => {
    const response = await request(app.getHttpServer()).get('/api/listings').set(auth(adminToken)).expect(200);
    expect((response.body as Envelope<{ total: number }>).data.total).toBe(60);
  });

  it('支持状态与关键词筛选', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/listings')
      .query({ status: 'signed', pageSize: 60 })
      .set(auth(adminToken))
      .expect(200);
    const data = (response.body as Envelope<{ items: ListingDto[] }>).data;
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.status === 'signed')).toBe(true);

    const keyword = await request(app.getHttpServer())
      .get('/api/listings')
      .query({ keyword: '锦绣华庭' })
      .set(auth(adminToken))
      .expect(200);
    expect((keyword.body as Envelope<{ total: number }>).data.total).toBeGreaterThan(0);
  });
});

describe('房源创建与状态机', () => {
  it('经纪人创建房源（自动编号 + 待审核）', async () => {
    const communities = await request(app.getHttpServer()).get('/api/communities/options').set(auth(agentToken)).expect(200);
    const community = (communities.body as Envelope<Array<{ id: string }>>).data[0];
    const sellers = await request(app.getHttpServer()).get('/api/users/options').query({ role: 'seller' }).set(auth(agentToken)).expect(200);
    const owner = (sellers.body as Envelope<Array<{ id: string }>>).data[0];

    const response = await request(app.getHttpServer())
      .post('/api/listings')
      .set(auth(agentToken))
      .send({
        communityId: community.id,
        ownerId: owner.id,
        title: 'M2 验收测试房源 3室2厅 南北精装',
        area: 96.5,
        unitPrice: 32000,
        rooms: 3,
        halls: 2,
        bathrooms: 2,
        orientation: '南北',
        floor: 8,
        totalFloors: 26,
        buildYear: 2015,
        propertyType: '商品房',
        decoration: '精装',
        description: 'M2 验收用例创建，用于验证录入→验真→上架链路。',
      })
      .expect(201);

    const listing = (response.body as Envelope<ListingDto>).data;
    createdListingId = listing.id;
    createdListingCode = listing.code;
    expect(listing.code).toMatch(/^FC-901-\d{6}$/);
    expect(listing.status).toBe('pending');
    expect(listing.verifyStatus).toBe('pending');
    expect(listing.totalPrice).toBe(Math.round((32000 * 96.5) / 1000) * 1000);
  });

  it('无委托协议时提交验真被拒绝（42201）', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/submit-verify`)
      .set(auth(agentToken))
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('上传委托协议（PDF）成功', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/attachments')
      .query({ bizType: 'listing_agreement', bizId: createdListingId })
      .set(auth(agentToken))
      .attach('file', Buffer.from('%PDF-1.4\n% demo contract'), '委托协议.pdf')
      .expect(201);
    const data = (response.body as Envelope<{ filePath: string; fileName: string }>).data;
    expect(data.filePath).toMatch(/^\/uploads\/listing_agreement\//);
    expect(data.fileName).toBe('委托协议.pdf');
  });

  it('提交验真后状态为待验真', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/submit-verify`)
      .set(auth(agentToken))
      .expect(201);
    expect((response.body as Envelope<ListingDto>).data.verifyStatus).toBe('pending');
  });

  it('未通过验真不能上架（42201）', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/publish`)
      .set(auth(agentToken))
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('经纪人无权审核房源（403）', async () => {
    await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/verify`)
      .set(auth(agentToken))
      .send({ pass: true })
      .expect(403);
  });

  it('管理员验真通过，经纪人上架成功', async () => {
    const verify = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/verify`)
      .set(auth(adminToken))
      .send({ pass: true })
      .expect(201);
    expect((verify.body as Envelope<ListingDto>).data.verifyStatus).toBe('verified');

    const publish = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/publish`)
      .set(auth(agentToken))
      .expect(201);
    const listing = (publish.body as Envelope<ListingDto>).data;
    expect(listing.status).toBe('on_sale');
    expect(listing.listedAt).not.toBeNull();
  });

  it('在售房源调价被拒绝（需先下架），修改描述允许', async () => {
    const rejected = await request(app.getHttpServer())
      .patch(`/api/listings/${createdListingId}`)
      .set(auth(agentToken))
      .send({ unitPrice: 35000 })
      .expect(400);
    expect((rejected.body as Envelope).code).toBe(42201);

    const ok = await request(app.getHttpServer())
      .patch(`/api/listings/${createdListingId}`)
      .set(auth(agentToken))
      .send({ description: '在售房源可更新描述文案。' })
      .expect(200);
    expect((ok.body as Envelope<ListingDto>).data.title).toContain('M2 验收');
  });

  it('其他经纪人不能操作该房源（404 数据隔离）', async () => {
    await request(app.getHttpServer())
      .patch(`/api/listings/${createdListingId}`)
      .set(auth(agent2Token))
      .send({ description: '越权修改' })
      .expect(404);
  });

  it('已签约房源不可下架（42201）', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/listings')
      .query({ status: 'signed', pageSize: 1 })
      .set(auth(adminToken))
      .expect(200);
    const signed = (list.body as Envelope<{ items: ListingDto[] }>).data.items[0];
    const response = await request(app.getHttpServer())
      .post(`/api/listings/${signed.id}/offline`)
      .set(auth(adminToken))
      .expect(400);
    expect((response.body as Envelope).code).toBe(42201);
  });

  it('在售房源可下架', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/offline`)
      .set(auth(agentToken))
      .expect(201);
    expect((response.body as Envelope<ListingDto>).data.status).toBe('offline');
  });

  it('验真驳回必须填写原因', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/listings/${createdListingId}/verify`)
      .set(auth(adminToken))
      .send({ pass: false })
      .expect(400);
    expect((response.body as Envelope).code).toBe(40001);
  });
});

describe('小区字典管理', () => {
  it('管理员可新建小区，重复创建返回 409', async () => {
    const payload = {
      name: `M2测试小区${uniqueSuffix}`,
      district: '城东区',
      businessArea: '东湖商圈',
      address: `江州市城东区东湖大道 ${uniqueSuffix % 100} 号`,
      buildYear: 2018,
      plotRatio: 2.1,
      greenRate: 0.36,
      propertyFee: 3.5,
      lng: 121.41,
      lat: 31.17,
    };
    const response = await request(app.getHttpServer())
      .post('/api/communities')
      .set(auth(adminToken))
      .send(payload)
      .expect(201);
    createdCommunityId = (response.body as Envelope<{ id: string }>).data.id;
    expect(createdCommunityId).toBeTruthy();

    const dupe = await request(app.getHttpServer())
      .post('/api/communities')
      .set(auth(adminToken))
      .send(payload)
      .expect(400);
    expect((dupe.body as Envelope).code).toBe(40901);
  });

  it('经纪人无权新建小区（403）', async () => {
    await request(app.getHttpServer())
      .post('/api/communities')
      .set(auth(agentToken))
      .send({ name: '越权小区', district: '城东区', businessArea: '东湖商圈', address: 'x', buildYear: 2010, plotRatio: 2, propertyFee: 2 })
      .expect(403);
  });

  it('小区列表包含在售数量与新建小区', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/communities')
      .query({ keyword: `M2测试小区${uniqueSuffix}` })
      .set(auth(managerToken))
      .expect(200);
    const data = (response.body as Envelope<{ items: Array<{ id: string; onSaleCount: number }> }>).data;
    expect(data.items.some((item) => item.id === createdCommunityId)).toBe(true);
  });
});

describe('C 端地图与价格参考', () => {
  it('地图点位接口返回在售房源坐标', async () => {
    const response = await request(app.getHttpServer()).get('/api/public/listings/map').expect(200);
    const points = (response.body as Envelope<Array<{ lng: number; lat: number; district: string }>>).data;
    // 种子 40 套在售；签约用例可能把部分转为已签约，故取下限
    expect(points.length).toBeGreaterThanOrEqual(38);
    expect(points.every((point) => typeof point.lng === 'number' && typeof point.lat === 'number')).toBe(true);
    expect(new Set(points.map((point) => point.district)).size).toBeGreaterThan(1);
  });

  it('房源详情包含小区/区域价格参考', async () => {
    const list = await request(app.getHttpServer()).get('/api/public/listings').query({ pageSize: 1 }).expect(200);
    const id = (list.body as Envelope<{ items: Array<{ id: string }> }>).data.items[0].id;
    const response = await request(app.getHttpServer()).get(`/api/public/listings/${id}`).expect(200);
    const detail = (response.body as Envelope<{
      priceContext: { communityAvgUnitPrice: number; districtAvgUnitPrice: number; communityOnSaleCount: number; sameCommunity: unknown[] };
    }>).data;
    expect(detail.priceContext.communityAvgUnitPrice).toBeGreaterThan(0);
    expect(detail.priceContext.districtAvgUnitPrice).toBeGreaterThan(0);
    expect(detail.priceContext.sameCommunity.length).toBeGreaterThan(0);
  });

  it('按建成年份筛选房源', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/listings')
      .query({ buildYearMin: 2015, pageSize: 50 })
      .expect(200);
    const items = (response.body as Envelope<{ items: Array<{ buildYear: number }> }>).data.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.buildYear >= 2015)).toBe(true);
  });
});

describe('附件查询', () => {
  it('按业务查询委托协议附件', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/attachments')
      .query({ bizType: 'listing_agreement', bizId: createdListingId })
      .set(auth(agentToken))
      .expect(200);
    const items = (response.body as Envelope<Array<{ fileName: string }>>).data;
    expect(items.length).toBe(1);
    expect(items[0].fileName).toBe('委托协议.pdf');
  });

  it('缺少参数返回 400', async () => {
    await request(app.getHttpServer()).get('/api/attachments').set(auth(agentToken)).expect(400);
  });
});
