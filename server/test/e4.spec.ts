/**
 * E4 P0 API 验收：客户跟进/匹配推荐、账号开通与权限菜单、数据字典、合同模板/补充条款、钥匙委托审批、投诉审核。
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
interface CustomerRow {
  id: string;
  name: string;
  type: string;
  agent: { name: string };
}
interface ListingRow {
  id: string;
  code: string;
  title: string;
  status: string;
  totalPrice: number;
}
interface ApprovalRow {
  id: string;
  code: string;
  type: string;
  typeLabel?: string;
  status: string;
  listing: { id: string; totalPrice: number } | null;
}
interface AgencyNode {
  id: string;
  name: string;
  type: string;
  children?: AgencyNode[];
}

const PASSWORD = '123456';
let adminToken = '';
let agentToken = '';
let managerToken = '';
let buyerToken = '';
let buyer2Token = '';
let buyerCustomer: CustomerRow | null = null;
let sellerCustomer: CustomerRow | null = null;
let agencyId = '';
let keyListing: ListingRow | null = null;
let createdComplaintId = '';
let newPhone = '';
let newUserId = '';

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function login(phone: string, password = PASSWORD): Promise<LoginData> {
  const response = await request(app.getHttpServer()).post('/api/auth/login').send({ phone, password }).expect(201);
  return (response.body as Envelope<LoginData>).data;
}

function flattenStores(nodes: AgencyNode[]): AgencyNode[] {
  const result: AgencyNode[] = [];
  const walk = (list: AgencyNode[]): void => {
    for (const node of list) {
      if (node.type === 'store') result.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  adminToken = (await login('13800000001')).token;
  agentToken = (await login('13800000020')).token;
  managerToken = (await login('13800000003')).token;
  buyerToken = (await login('13800000040')).token;
  buyer2Token = (await login('13800000041')).token;

  const customers = await request(app.getHttpServer()).get('/api/customers').query({ pageSize: 60 }).set(auth(agentToken)).expect(200);
  const items = (customers.body as Envelope<{ items: CustomerRow[] }>).data.items;
  buyerCustomer = items.find((item) => item.type === 'buyer') ?? items[0];
  sellerCustomer = items.find((item) => item.type === 'seller') ?? null;

  const agencies = await request(app.getHttpServer()).get('/api/agencies').set(auth(adminToken)).expect(200);
  const stores = flattenStores((agencies.body as Envelope<AgencyNode[]>).data);
  agencyId = stores[0].id;

  const listings = await request(app.getHttpServer()).get('/api/listings').query({ status: 'on_sale', pageSize: 60 }).set(auth(agentToken)).expect(200);
  keyListing = (listings.body as Envelope<{ items: ListingRow[] }>).data.items[0];
});

afterAll(async () => {
  await app.close();
});

describe('客户跟进与匹配推荐', () => {
  it('新增跟进记录并按时间倒序返回', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/customers/${buyerCustomer?.id}/follow-ups`)
      .set(auth(agentToken))
      .send({ content: 'E4 验收：电话回访确认预算与意向区域', nextAction: '安排二次带看' })
      .expect(201);
    expect((create.body as Envelope<{ content: string }>).data.content).toContain('E4 验收');

    const list = await request(app.getHttpServer()).get(`/api/customers/${buyerCustomer?.id}/follow-ups`).set(auth(agentToken)).expect(200);
    const rows = (list.body as Envelope<Array<{ content: string }>>).data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].content).toContain('E4 验收');
  });

  it('跟进内容为空 → 400；详情包含跟进记录', async () => {
    await request(app.getHttpServer()).post(`/api/customers/${buyerCustomer?.id}/follow-ups`).set(auth(agentToken)).send({ content: '' }).expect(400);
    const detail = await request(app.getHttpServer()).get(`/api/customers/${buyerCustomer?.id}`).set(auth(agentToken)).expect(200);
    const data = (detail.body as Envelope<{ followUps: unknown[] }>).data;
    expect(Array.isArray(data.followUps)).toBe(true);
    expect(data.followUps.length).toBeGreaterThan(0);
  });

  it('买方客户返回匹配房源（按分数倒序），卖方返回空', async () => {
    const matches = await request(app.getHttpServer()).get(`/api/customers/${buyerCustomer?.id}/matches`).set(auth(agentToken)).expect(200);
    const items = (matches.body as Envelope<Array<{ score: number; totalPrice: number; reasons: string[] }>>).data;
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i += 1) expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    expect(items.every((item) => item.score > 0 && item.totalPrice > 0)).toBe(true);

    if (sellerCustomer) {
      const sellerMatches = await request(app.getHttpServer()).get(`/api/customers/${sellerCustomer.id}/matches`).set(auth(agentToken)).expect(200);
      expect((sellerMatches.body as Envelope<unknown[]>).data).toHaveLength(0);
    }
  });

  it('买方无权访问客户接口（403）', async () => {
    await request(app.getHttpServer()).get(`/api/customers/${buyerCustomer?.id}/matches`).set(auth(buyerToken)).expect(403);
  });
});

describe('账号开通与权限菜单配置', () => {
  it('管理员开通经纪人账号并分配门店', async () => {
    newPhone = `139${String(Date.now()).slice(-8)}`;
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .set(auth(adminToken))
      .send({ phone: newPhone, name: 'E4验收经纪人', role: 'agent', agencyId, password: '123456' })
      .expect(201);
    const user = (response.body as Envelope<{ id: string; role: string; agencyId: string }>).data;
    newUserId = user.id;
    expect(user.role).toBe('agent');
    expect(user.agencyId).toBe(agencyId);

    const loginResult = await login(newPhone);
    expect(loginResult.user.role).toBe('agent');

    const agentRow = await request(app.getHttpServer()).get('/api/agents').query({ agencyId }).set(auth(adminToken)).expect(200);
    expect((agentRow.body as Envelope<Array<{ userId?: string }>>).data.some((item) => item.userId === newUserId)).toBe(true);
  });

  it('手机号重复开通 → 409；经纪人无权开通账号（403）', async () => {
    const duplicate = await request(app.getHttpServer())
      .post('/api/users')
      .set(auth(adminToken))
      .send({ phone: newPhone, name: '重复账号', role: 'agent', agencyId })
      .expect(400);
    expect((duplicate.body as Envelope).code).toBe(40901);
    await request(app.getHttpServer()).post('/api/users').set(auth(agentToken)).send({ phone: '13900000001', name: '越权', role: 'agent', agencyId }).expect(403);
  });

  it('修改账号角色为店长', async () => {
    const response = await request(app.getHttpServer()).patch(`/api/users/${newUserId}`).set(auth(adminToken)).send({ role: 'store_manager', agencyId }).expect(200);
    expect((response.body as Envelope<{ role: string }>).data.role).toBe('store_manager');
  });

  it('角色菜单配置：读取、修改并恢复', async () => {
    const mine = await request(app.getHttpServer()).get('/api/admin/menu-config/my').set(auth(agentToken)).expect(200);
    const original = (mine.body as Envelope<{ menuKeys: string[] }>).data.menuKeys;
    expect(original).toContain('/admin/listings');

    const updated = await request(app.getHttpServer()).put('/api/admin/menu-config').set(auth(adminToken)).send({ role: 'agent', menuKeys: original.filter((key) => key !== '/admin/showings') }).expect(200);
    expect((updated.body as Envelope<{ menuKeys: string[] }>).data.menuKeys).not.toContain('/admin/showings');

    const after = await request(app.getHttpServer()).get('/api/admin/menu-config/my').set(auth(agentToken)).expect(200);
    expect((after.body as Envelope<{ menuKeys: string[] }>).data.menuKeys).not.toContain('/admin/showings');

    await request(app.getHttpServer()).put('/api/admin/menu-config').set(auth(adminToken)).send({ role: 'agent', menuKeys: original }).expect(200);
  });

  it('经纪人无权读写菜单配置（403）', async () => {
    await request(app.getHttpServer()).get('/api/admin/menu-config').set(auth(agentToken)).expect(403);
    await request(app.getHttpServer()).put('/api/admin/menu-config').set(auth(agentToken)).send({ role: 'agent', menuKeys: [] }).expect(403);
  });
});

describe('数据字典管理', () => {
  it('新增/修改/删除字典项', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/admin/dicts')
      .set(auth(adminToken))
      .send({ category: 'e4_test', key: 't1', label: '验收字典', value: '验收字典', sortOrder: 1 })
      .expect(201);
    const dict = (created.body as Envelope<{ id: string }>).data;

    const duplicate = await request(app.getHttpServer()).post('/api/admin/dicts').set(auth(adminToken)).send({ category: 'e4_test', key: 't1', label: '重复' }).expect(400);
    expect((duplicate.body as Envelope).code).toBe(40901);

    const updated = await request(app.getHttpServer()).patch(`/api/admin/dicts/${dict.id}`).set(auth(adminToken)).send({ label: '验收字典-改' }).expect(200);
    expect((updated.body as Envelope<{ label: string }>).data.label).toBe('验收字典-改');

    await request(app.getHttpServer()).delete(`/api/admin/dicts/${dict.id}`).set(auth(adminToken)).expect(200);
    const list = await request(app.getHttpServer()).get('/api/admin/dicts').set(auth(adminToken)).expect(200);
    expect((list.body as Envelope<Array<{ key: string }>>).data.some((item) => item.key === 't1')).toBe(false);
  });

  it('经纪人无权管理字典（403）', async () => {
    await request(app.getHttpServer()).get('/api/admin/dicts').set(auth(agentToken)).expect(403);
  });
});

describe('合同模板与补充条款', () => {
  it('管理员新增模板、停用后发起签约不可选', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/contracts/templates')
      .set(auth(adminToken))
      .send({ name: 'E4验收合同模板', version: 'V1.0', content: '甲方：{{sellerName}} 乙方：{{buyerName}} 成交价：{{amount}}' })
      .expect(201);
    const template = (created.body as Envelope<{ id: string }>).data;

    const duplicate = await request(app.getHttpServer()).post('/api/contracts/templates').set(auth(adminToken)).send({ name: 'E4验收合同模板', version: 'V1.0', content: 'x' }).expect(400);
    expect((duplicate.body as Envelope).code).toBe(40901);

    const disabled = await request(app.getHttpServer()).patch(`/api/contracts/templates/${template.id}`).set(auth(adminToken)).send({ isActive: false }).expect(200);
    expect((disabled.body as Envelope<{ isActive: boolean }>).data.isActive).toBe(false);

    const active = await request(app.getHttpServer()).get('/api/contracts/templates').set(auth(agentToken)).expect(200);
    expect((active.body as Envelope<Array<{ id: string }>>).data.some((item) => item.id === template.id)).toBe(false);
  });

  it('发起合同时在线填写补充条款并在详情返回', async () => {
    const listings = await request(app.getHttpServer()).get('/api/listings').query({ status: 'on_sale', pageSize: 60 }).set(auth(adminToken)).expect(200);
    const listing = (listings.body as Envelope<{ items: ListingRow[] }>).data.items[0];
    const customers = await request(app.getHttpServer()).get('/api/customers').query({ pageSize: 60 }).set(auth(adminToken)).expect(200);
    const customersData = (customers.body as Envelope<{ items: CustomerRow[] }>).data.items;
    const buyer = customersData.find((item) => item.type === 'buyer');
    const seller = customersData.find((item) => item.type === 'seller');
    const templates = await request(app.getHttpServer()).get('/api/contracts/templates').set(auth(adminToken)).expect(200);
    const template = (templates.body as Envelope<Array<{ id: string }>>).data[0];

    const created = await request(app.getHttpServer())
      .post('/api/contracts')
      .set(auth(adminToken))
      .send({ listingId: listing.id, buyerCustomerId: buyer?.id, sellerCustomerId: seller?.id, templateId: template.id, terms: 'E4 验收补充条款：家具家电按现状保留。' })
      .expect(201);
    const contract = (created.body as Envelope<{ id: string; customTerms?: string }>).data;
    expect(contract.customTerms).toContain('E4 验收补充条款');
    const detail = await request(app.getHttpServer()).get(`/api/contracts/${contract.id}`).set(auth(adminToken)).expect(200);
    expect((detail.body as Envelope<{ customTerms: string }>).data.customTerms).toContain('E4 验收补充条款');
  });

  it('经纪人无权管理模板（403）', async () => {
    await request(app.getHttpServer()).post('/api/contracts/templates').set(auth(agentToken)).send({ name: 'x', version: 'V1', content: 'x' }).expect(403);
  });
});

describe('钥匙委托审批', () => {
  it('经纪人发起钥匙委托，店长审批通过且不改价', async () => {
    const before = await request(app.getHttpServer()).get(`/api/listings/${keyListing?.id}`).set(auth(agentToken)).expect(200);
    const beforePrice = (before.body as Envelope<ListingRow>).data.totalPrice;

    const create = await request(app.getHttpServer())
      .post('/api/approvals/key-handover')
      .set(auth(agentToken))
      .send({ listingId: keyListing?.id, keyCount: 2, handoverTo: '城东店钥匙柜', remark: 'E4 验收：业主委托门店保管' })
      .expect(201);
    const approval = (create.body as Envelope<ApprovalRow>).data;
    expect(approval.type).toBe('key_handover');
    expect(approval.typeLabel).toBe('钥匙委托审批');

    const duplicate = await request(app.getHttpServer())
      .post('/api/approvals/key-handover')
      .set(auth(agentToken))
      .send({ listingId: keyListing?.id, keyCount: 1, handoverTo: '重复' })
      .expect(400);
    expect((duplicate.body as Envelope).code).toBe(40901);

    const managerList = await request(app.getHttpServer()).get('/api/approvals').query({ pageSize: 60 }).set(auth(managerToken)).expect(200);
    expect((managerList.body as Envelope<{ items: ApprovalRow[] }>).data.items.some((item) => item.id === approval.id && item.type === 'key_handover')).toBe(true);

    const approved = await request(app.getHttpServer()).post(`/api/approvals/${approval.id}/approve`).set(auth(managerToken)).send({ comment: '同意钥匙委托' }).expect(201);
    expect((approved.body as Envelope<ApprovalRow>).data.status).toBe('approved');

    const after = await request(app.getHttpServer()).get(`/api/listings/${keyListing?.id}`).set(auth(agentToken)).expect(200);
    expect((after.body as Envelope<ListingRow>).data.totalPrice).toBe(beforePrice);
    const history = (after.body as Envelope<{ priceHistory: Array<{ source: string; remark?: string }> }>).data.priceHistory;
    expect(history.some((item) => item.remark?.includes('钥匙'))).toBe(false);
  });

  it('经纪人不能为他人房源发起钥匙委托（403）', async () => {
    if (!keyListing) return;
    const otherListings = await request(app.getHttpServer()).get('/api/listings').query({ status: 'on_sale', pageSize: 60 }).set(auth(adminToken)).expect(200);
    const other = (otherListings.body as Envelope<{ items: Array<ListingRow & { agent?: { id: string } }> }>).data.items.find((item) => item.id !== keyListing?.id);
    if (!other) return;
    await request(app.getHttpServer()).post('/api/approvals/key-handover').set(auth(agentToken)).send({ listingId: other.id, keyCount: 1, handoverTo: 'x' }).expect(403);
  });
});

describe('投诉审核', () => {
  it('买方提交投诉、查看我的投诉，管理员处理并通知', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/complaints')
      .set(auth(buyerToken))
      .send({ type: 'listing_quality', content: 'E4 验收：房源照片与实勘不符', contactName: '张伟', contactPhone: '13800000040', listingId: keyListing?.id })
      .expect(201);
    const complaint = (create.body as Envelope<{ id: string; code: string; status: string }>).data;
    expect(complaint.code).toMatch(/^TS\d{10}$/);
    expect(complaint.status).toBe('pending');
    createdComplaintId = complaint.id;

    const my = await request(app.getHttpServer()).get('/api/complaints/my').set(auth(buyerToken)).expect(200);
    expect((my.body as Envelope<Array<{ id: string }>>).data.some((item) => item.id === complaint.id)).toBe(true);

    const adminList = await request(app.getHttpServer()).get('/api/complaints').query({ status: 'pending', pageSize: 60 }).set(auth(adminToken)).expect(200);
    expect((adminList.body as Envelope<{ items: Array<{ id: string }> }>).data.items.some((item) => item.id === complaint.id)).toBe(true);

    const handled = await request(app.getHttpServer()).post(`/api/complaints/${complaint.id}/handle`).set(auth(adminToken)).send({ status: 'resolved', comment: '已联系经纪人核实并回访客户' }).expect(201);
    expect((handled.body as Envelope<{ status: string }>).data.status).toBe('resolved');

    const again = await request(app.getHttpServer()).post(`/api/complaints/${complaint.id}/handle`).set(auth(adminToken)).send({ status: 'resolved', comment: '重复处理' }).expect(400);
    expect((again.body as Envelope).code).toBe(42201);
  });

  it('投诉人仅能看到自己的投诉；非 C 端角色不能提交投诉（403）', async () => {
    const my2 = await request(app.getHttpServer()).get('/api/complaints/my').set(auth(buyer2Token)).expect(200);
    expect((my2.body as Envelope<Array<{ id: string }>>).data.some((item) => item.id === createdComplaintId)).toBe(false);
    await request(app.getHttpServer()).post('/api/complaints').set(auth(agentToken)).send({ type: 'other', content: 'x', contactName: 'x', contactPhone: '13800000000' }).expect(403);
  });
});
