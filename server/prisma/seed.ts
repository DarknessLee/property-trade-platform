// 种子数据：全部为虚构机构/小区/人名，编码、金额、日期自洽，符合真实业务口径。
// 运行：npm run db:seed（由 db:reset 自动调用），结束后由 validate.ts 自动校验。
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = '123456';
const CITY_CODE = '901'; // 演示城市：江州市（虚构）

// ---------- 可复现伪随机 ----------
let rngState = 20261028;
function rnd(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
function randInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)] as T;
}
function daysAgo(n: number): Date {
  return dayjs().subtract(n, 'day').toDate();
}
function daysAhead(n: number): Date {
  return dayjs().add(n, 'day').toDate();
}
function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

// ---------- 身份证（校验位合法，区域码 310101，仅演示） ----------
const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
function makeIdCard(seq: number): { masked: string; hash: string } {
  const area = '310101';
  const year = randInt(1965, 1998);
  const month = pad(randInt(1, 12), 2);
  const day = pad(randInt(1, 28), 2);
  const order = pad((seq * 7) % 1000, 3);
  const body = `${area}${year}${month}${day}${order}`;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(body[i]) * ID_WEIGHTS[i];
  const check = ID_CHECK[sum % 11];
  return {
    masked: `${body.slice(0, 6)}********${body.slice(14)}${check}`,
    hash: `${body}${check}`,
  };
}

// ---------- 基础字典 ----------
const ORIENTATIONS = ['南', '南北', '东南', '西南', '东', '西'] as const;
const DECORATIONS = ['毛坯', '简装', '精装', '豪装'] as const;
const PROPERTY_TYPES = ['商品房', '房改房', '经济适用房', '公寓'] as const;
const DISTRICTS = ['城东区', '城西区', '高新区', '滨江区', '世纪城区'] as const;

// 15 个虚构小区
const COMMUNITY_DEFS = [
  { name: '锦绣华庭', district: '城东区', businessArea: '东湖商圈', buildYear: 2012, propertyFee: 3.2 },
  { name: '阳光里', district: '城东区', businessArea: '东湖商圈', buildYear: 2008, propertyFee: 2.6 },
  { name: '云栖花园', district: '城东区', businessArea: '云栖商圈', buildYear: 2018, propertyFee: 4.1 },
  { name: '金色家园', district: '城西区', businessArea: '西山商圈', buildYear: 2005, propertyFee: 2.2 },
  { name: '书香雅苑', district: '城西区', businessArea: '学府商圈', buildYear: 2015, propertyFee: 3.4 },
  { name: '翠湖天地', district: '城西区', businessArea: '翠湖商圈', buildYear: 2020, propertyFee: 4.8 },
  { name: '中央公园', district: '高新区', businessArea: '科技城商圈', buildYear: 2016, propertyFee: 3.8 },
  { name: '星河湾', district: '高新区', businessArea: '科技城商圈', buildYear: 2019, propertyFee: 4.3 },
  { name: '东方明珠苑', district: '高新区', businessArea: '滨河商圈', buildYear: 2010, propertyFee: 2.9 },
  { name: '滨江壹号', district: '滨江区', businessArea: '滨江商圈', buildYear: 2021, propertyFee: 5.2 },
  { name: '江南名邸', district: '滨江区', businessArea: '滨江商圈', buildYear: 2013, propertyFee: 3.6 },
  { name: '御景华府', district: '滨江区', businessArea: '南岸商圈', buildYear: 2017, propertyFee: 4.5 },
  { name: '湖畔家园', district: '世纪城区', businessArea: '世纪城商圈', buildYear: 2007, propertyFee: 2.4 },
  { name: '龙湖春江', district: '世纪城区', businessArea: '世纪城商圈', buildYear: 2014, propertyFee: 3.1 },
  { name: '城汇花园', district: '世纪城区', businessArea: '新城商圈', buildYear: 2003, propertyFee: 2.0 },
] as const;

// 5 个门店（+1 个机构总部）
const AGENCY_DEFS = [
  { name: '安家地产（江城总部）', type: 'hq', short: '安家总部' },
  { name: '安家地产·城东店', type: 'store', short: '城东店' },
  { name: '安家地产·城西店', type: 'store', short: '城西店' },
  { name: '安家地产·高新店', type: 'store', short: '高新店' },
  { name: '安家地产·滨江店', type: 'store', short: '滨江店' },
  { name: '安家地产·世纪城店', type: 'store', short: '世纪城店' },
] as const;

const AGENT_NAMES = ['陈志远', '林晓梅', '王浩然', '周雨桐', '赵天宇', '孙梦洁', '李承泽', '杨紫萱', '吴子豪', '郑雅琪', '冯俊杰', '何欣然'];
const BUYER_NAMES = ['张伟', '刘芳', '黄磊', '徐静', '马涛', '朱琳', '胡军', '郭敏'];
const SELLER_NAMES = ['高强', '罗雪', '梁栋', '宋佳', '唐勇', '韩冰', '曹阳', '谢婷', '邓超'];

async function main(): Promise<void> {
  console.log('[seed] 清理旧数据 ...');
  await prisma.consultation.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.transactionProgress.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.showing.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.houseListing.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.realNameAuth.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.operationLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.community.deleteMany();
  await prisma.contractTemplate.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.dataDict.deleteMany();

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // ---------- 数据字典 ----------
  const dictDefs: Array<{ category: string; key: string; label: string; value?: string }> = [];
  ORIENTATIONS.forEach((v, i) => dictDefs.push({ category: 'orientation', key: `o${i}`, label: v, value: v }));
  DECORATIONS.forEach((v, i) => dictDefs.push({ category: 'decoration', key: `d${i}`, label: v, value: v }));
  PROPERTY_TYPES.forEach((v, i) => dictDefs.push({ category: 'property_type', key: `p${i}`, label: v, value: v }));
  [
    ['pending', '待审核'],
    ['on_sale', '在售'],
    ['signed', '已签约'],
    ['offline', '已下架'],
  ].forEach(([k, l]) => dictDefs.push({ category: 'listing_status', key: k, label: l }));
  [
    ['pending', '待验真'],
    ['verified', '已验真'],
    ['rejected', '验真驳回'],
  ].forEach(([k, l]) => dictDefs.push({ category: 'verify_status', key: k, label: l }));
  [
    ['draft', '草稿'],
    ['pending', '待签署'],
    ['signed', '已签署'],
    ['voided', '已作废'],
  ].forEach(([k, l]) => dictDefs.push({ category: 'sign_status', key: k, label: l }));
  [
    ['sign', '面签'],
    ['loan', '贷款审批'],
    ['tax', '缴税'],
    ['transfer', '过户'],
    ['handover', '交房'],
  ].forEach(([k, l]) => dictDefs.push({ category: 'progress_node', key: k, label: l }));
  [
    ['buyer', '买方'],
    ['seller', '卖方'],
    ['agent', '经纪人'],
    ['store_manager', '店长'],
    ['finance', '财务'],
    ['admin', '平台管理员'],
  ].forEach(([k, l]) => dictDefs.push({ category: 'role', key: k, label: l }));
  [
    ['deposit', '定金'],
    ['down_payment', '首付'],
    ['balance', '尾款'],
    ['commission', '佣金'],
  ].forEach(([k, l]) => dictDefs.push({ category: 'payment_type', key: k, label: l }));
  for (const d of dictDefs) {
    await prisma.dataDict.create({ data: d });
  }

  // ---------- 机构 / 门店 ----------
  const hq = await prisma.agency.create({
    data: {
      name: AGENCY_DEFS[0].name,
      type: 'hq',
      licenseNo: 'JJ-2020-0001',
      address: '江州市城东区东湖大道 88 号安家大厦 12 层',
      phone: '0571-88000001',
    },
  });
  const stores = [];
  for (let i = 1; i < AGENCY_DEFS.length; i += 1) {
    const def = AGENCY_DEFS[i];
    const store = await prisma.agency.create({
      data: {
        name: def.name,
        type: 'store',
        licenseNo: `JJ-2021-000${i}`,
        address: `江州市${def.short.replace('店', '')}商圈安家大厦 ${i} 号`,
        phone: `0571-8800000${i + 1}`,
        parentId: hq.id,
      },
    });
    stores.push(store);
  }

  // ---------- 用户 ----------
  const commonUser = { passwordHash, email: null as string | null };

  const admin = await prisma.user.create({
    data: { ...commonUser, phone: '13800000001', name: '平台管理员', role: 'admin' },
  });
  const finance = await prisma.user.create({
    data: { ...commonUser, phone: '13800000002', name: '财务专员·邱丽', role: 'finance', agencyId: hq.id },
  });
  const managerNames = ['店长·赵敏', '店长·钱峰', '店长·孙莉', '店长·李强', '店长·周慧'];
  const managers = [];
  for (let i = 0; i < stores.length; i += 1) {
    const manager = await prisma.user.create({
      data: { ...commonUser, phone: `1380000000${i + 3}`, name: managerNames[i], role: 'store_manager', agencyId: stores[i].id },
    });
    managers.push(manager);
  }

  const agentUsers = [];
  for (let i = 0; i < AGENT_NAMES.length; i += 1) {
    const agentUser = await prisma.user.create({
      data: { ...commonUser, phone: `138000000${pad(i + 20, 2)}`, name: AGENT_NAMES[i], role: 'agent' },
    });
    agentUsers.push(agentUser);
  }

  const buyerUsers = [];
  for (let i = 0; i < BUYER_NAMES.length; i += 1) {
    const buyer = await prisma.user.create({
      data: { ...commonUser, phone: `138000000${pad(i + 40, 2)}`, name: BUYER_NAMES[i], role: 'buyer' },
    });
    buyerUsers.push(buyer);
  }

  const sellerUsers = [];
  for (let i = 0; i < SELLER_NAMES.length; i += 1) {
    const seller = await prisma.user.create({
      data: { ...commonUser, phone: `138000000${pad(i + 60, 2)}`, name: SELLER_NAMES[i], role: 'seller' },
    });
    sellerUsers.push(seller);
  }

  // 实名认证：经纪人、买卖双方全部已通过；管理员/财务/店长部分通过
  const realNameTargets = [...agentUsers, ...buyerUsers, ...sellerUsers, admin, finance, ...managers];
  for (let i = 0; i < realNameTargets.length; i += 1) {
    const u = realNameTargets[i];
    const idCard = makeIdCard(i + 1);
    await prisma.realNameAuth.create({
      data: {
        userId: u.id,
        realName: u.name.replace(/^店长·|^财务专员·/, ''),
        idCardMasked: idCard.masked,
        idCardHash: idCard.hash,
        status: i % 17 === 16 ? 'pending' : 'approved',
        submittedAt: daysAgo(randInt(60, 400)),
        reviewedAt: i % 17 === 16 ? null : daysAgo(randInt(30, 59)),
        reviewerId: admin.id,
      },
    });
  }

  // ---------- 经纪人 ----------
  const agents = [];
  for (let i = 0; i < agentUsers.length; i += 1) {
    const store = stores[i % stores.length];
    await prisma.user.update({ where: { id: agentUsers[i].id }, data: { agencyId: store.id } });
    const agent = await prisma.agent.create({
      data: {
        userId: agentUsers[i].id,
        agencyId: store.id,
        licenseNo: `ZY-2021-${pad(i + 1, 4)}`,
        title: i % 4 === 0 ? '金牌经纪人' : '房产经纪人',
        joinedAt: daysAgo(randInt(200, 1500)),
        status: 'active',
      },
    });
    agents.push(agent);
  }

  // ---------- 小区 ----------
  // 各区域基准坐标（虚构城市「江州市」，用于地图找房展示）
  const DISTRICT_COORDS: Record<string, { lng: number; lat: number }> = {
    城东区: { lng: 121.445, lat: 31.215 },
    城西区: { lng: 121.335, lat: 31.205 },
    高新区: { lng: 121.44, lat: 31.125 },
    滨江区: { lng: 121.395, lat: 31.085 },
    世纪城区: { lng: 121.35, lat: 31.15 },
  };
  const communities = [];
  for (let i = 0; i < COMMUNITY_DEFS.length; i += 1) {
    const def = COMMUNITY_DEFS[i];
    const base = DISTRICT_COORDS[def.district] ?? { lng: 121.39, lat: 31.16 };
    const community = await prisma.community.create({
      data: {
        name: def.name,
        district: def.district,
        businessArea: def.businessArea,
        address: `江州市${def.district}${def.businessArea}${def.name} ${randInt(1, 30)} 号`,
        buildYear: def.buildYear,
        totalBuildings: randInt(6, 28),
        plotRatio: Number((1.2 + rnd() * 2.2).toFixed(2)),
        greenRate: Number((0.25 + rnd() * 0.2).toFixed(2)),
        propertyFee: def.propertyFee,
        lng: Number((base.lng + (rnd() - 0.5) * 0.02).toFixed(6)),
        lat: Number((base.lat + (rnd() - 0.5) * 0.018).toFixed(6)),
      },
    });
    communities.push(community);
  }

  // ---------- 房源 ----------
  const UNIT_PRICE_RANGE: Record<string, [number, number]> = {
    城东区: [33000, 42000],
    城西区: [27000, 34000],
    高新区: [30000, 39000],
    滨江区: [39000, 48000],
    世纪城区: [24000, 30000],
  };
  const SIZES = [58.5, 68.0, 72.5, 88.0, 95.5, 102.0, 118.5, 128.0, 143.5, 168.0, 185.0];
  const listings = [];
  for (let i = 0; i < 60; i += 1) {
    const community = communities[i % communities.length];
    const area = pick(SIZES);
    const [lo, hi] = UNIT_PRICE_RANGE[community.district] ?? [25000, 40000];
    let unitPrice = randInt(lo, hi);
    unitPrice = Math.round(unitPrice / 100) * 100;
    const totalPrice = Math.round((area * unitPrice) / 1000) * 1000;
    const rooms = area < 70 ? 1 : area < 90 ? 2 : area < 130 ? 3 : 4;
    const halls = area < 70 ? 1 : 2;
    const bathrooms = area < 90 ? 1 : 2;
    const agent = agents[i % agents.length];
    const owner = sellerUsers[i % sellerUsers.length];
    const status = i < 40 ? 'on_sale' : i < 46 ? 'pending' : i < 54 ? 'signed' : 'offline';
    const verifyStatus = status === 'pending' ? (i % 3 === 0 ? 'pending' : 'rejected') : 'verified';
    const listedAt = status === 'pending' ? null : daysAgo(randInt(3, 180));
    const soldAt = status === 'signed' ? daysAgo(randInt(1, 40)) : null;
    const listing = await prisma.houseListing.create({
      data: {
        code: `FC-${CITY_CODE}-${pad(i + 1, 6)}`,
        title: `${community.name} ${rooms}室${halls}厅 ${pick(ORIENTATIONS)}${pick(DECORATIONS)}`,
        communityId: community.id,
        ownerId: owner.id,
        agentId: agent.id,
        agencyId: agent.agencyId,
        area,
        totalPrice,
        unitPrice,
        rooms,
        halls,
        bathrooms,
        orientation: pick(ORIENTATIONS),
        floor: randInt(2, 26),
        totalFloors: randInt(18, 33),
        buildYear: community.buildYear,
        propertyType: pick(PROPERTY_TYPES),
        decoration: pick(DECORATIONS),
        status,
        verifyStatus,
        description: `${community.name}，${area}㎡，${rooms}室${halls}厅，采光充足，业主诚心出售。小区${community.businessArea}核心位置，周边配套成熟，交通便利。`,
        imagesJson: JSON.stringify(
          [1, 2, 3, 4].map((k) => ({
            name: ['客厅', '卧室', '厨房', '户型图'][k - 1],
            url: `/mock/listings/${((i + k) % 12) + 1}.svg`,
          })),
        ),
        address: `${community.district}${community.businessArea}${community.name}${randInt(1, 20)}号楼${randInt(1, 30)}0${randInt(1, 4)}室`,
        lng: community.lng + (rnd() - 0.5) * 0.01,
        lat: community.lat + (rnd() - 0.5) * 0.01,
        listedAt,
        soldAt,
        viewCount: randInt(10, 800),
      },
    });
    listings.push(listing);
  }

  // ---------- 房源价格历史（挂牌与历史调价，供价格走势展示） ----------
  for (const listing of listings) {
    if (listing.status === 'pending') continue; // 未挂牌无价格历史
    const baseDate = listing.listedAt ?? daysAgo(120);
    const points = listing.area > 120 || listing.code.endsWith('0001') ? 4 : 3;
    for (let k = 0; k < points; k += 1) {
      const isLast = k === points - 1;
      const price = isLast
        ? listing.totalPrice
        : Math.round((listing.totalPrice * (0.94 + 0.015 * k)) / 1000) * 1000;
      const unitPrice = Math.round(price / listing.area);
      await prisma.priceHistory.create({
        data: {
          listingId: listing.id,
          price,
          unitPrice,
          source: 'listing',
          remark: isLast ? '当前挂牌价' : k === 0 ? '首次挂牌价' : '历史调价',
          changedAt: dayjs(baseDate).subtract((points - 1 - k) * 30, 'day').toDate(),
        },
      });
    }
  }

  // ---------- 客户 ----------
  const customers = [];
  for (let i = 0; i < 30; i += 1) {
    const isBuyer = i < 18;
    const agent = agents[i % agents.length];
    const budgetMin = isBuyer ? randInt(150, 400) * 10000 : null;
    const budgetMax = isBuyer ? (budgetMin as number) + randInt(50, 200) * 10000 : null;
    const customer = await prisma.customer.create({
      data: {
        code: `KH-${pad(i + 1, 6)}`,
        name: isBuyer ? BUYER_NAMES[i % BUYER_NAMES.length] : SELLER_NAMES[i % SELLER_NAMES.length],
        phone: `139000000${pad(i + 1, 2)}`,
        type: isBuyer ? 'buyer' : 'seller',
        budgetMin,
        budgetMax,
        demand: isBuyer
          ? `求购${pick(DISTRICTS)}${randInt(60, 140)}㎡左右，${pick(['满五唯一', '近地铁', '学区房', '低楼层'])}优先`
          : `出售${pick(DISTRICTS)}自住房，面积约${randInt(70, 150)}㎡`,
        tagsJson: JSON.stringify([pick(['刚需', '改善', '投资']), pick(['地铁房', '学区房', '江景房', '近医院'])]),
        agentId: agent.id,
        agencyId: agent.agencyId,
        level: pick(['A', 'A', 'B', 'B', 'B', 'C']),
        protectionUntil: daysAhead(randInt(1, 30)),
        // 每个 C 端演示账号只关联一个客户档案，其余客户为经纪人自行录入（不绑定登录账号）
        userId: isBuyer
          ? i < buyerUsers.length
            ? buyerUsers[i].id
            : null
          : i - 18 < sellerUsers.length
            ? sellerUsers[i - 18].id
            : null,
        status: 'following',
        createdAt: daysAgo(randInt(10, 120)),
      },
    });
    customers.push(customer);
  }

  // ---------- 带看 ----------
  const showings = [];
  for (let i = 0; i < 45; i += 1) {
    const listing = listings[i % 40];
    const agentId = listing.agentId;
    const sameAgencyCustomers = customers.filter((c) => c.agencyId === listing.agencyId && c.type === 'buyer');
    const customer = sameAgencyCustomers.length > 0 ? sameAgencyCustomers[i % sameAgencyCustomers.length] : customers[i % 18];
    const status = i < 28 ? 'done' : i < 36 ? 'confirmed' : i < 41 ? 'pending' : 'cancelled';
    const scheduledAt = status === 'done' ? daysAgo(randInt(1, 60)) : daysAhead(randInt(1, 14));
    const showing = await prisma.showing.create({
      data: {
        code: `DK${dayjs(scheduledAt).format('YYYYMMDD')}${pad(i + 1, 4)}`,
        listingId: listing.id,
        customerId: customer.id,
        agentId,
        scheduledAt,
        actualAt: status === 'done' ? scheduledAt : null,
        durationMin: pick([30, 45, 60]),
        status,
        feedback:
          status === 'done'
            ? pick([
                '客户认可户型与采光，对价格有异议。',
                '客户对小区环境满意，考虑与家人再看一次。',
                '客户认为楼层偏低，暂无成交意向。',
                '客户已看过同小区其他房源，倾向本套。',
              ])
            : null,
        rating: status === 'done' ? pick(['A', 'B', 'B', 'C']) : null,
      },
    });
    showings.push(showing);
  }

  // ---------- 合同模板 ----------
  const templateV1 = await prisma.contractTemplate.create({
    data: {
      name: '江州市存量房屋买卖合同（示范文本）',
      version: 'V1.0',
      content: [
        '# 江州市存量房屋买卖合同',
        '',
        '出卖人（甲方）：{{sellerName}}',
        '买受人（乙方）：{{buyerName}}',
        '居间方（丙方）：{{agencyName}}',
        '',
        '第一条 房屋基本情况：{{communityName}} {{address}}，建筑面积 {{area}} ㎡。',
        '第二条 成交价格：人民币 {{amount}} 元（大写：{{amountCn}}）。',
        '第三条 定金：人民币 {{depositAmount}} 元，于本合同签订时支付。',
        '第四条 付款方式：{{paymentTerms}}。',
        '第五条 过户与交房：双方应于 {{transferDeadline}} 前办理过户登记。',
        '第六条 佣金：按成交价 {{commissionRate}} 计收，共计 {{commissionAmount}} 元，由 {{commissionPayer}} 承担。',
        '第七条 违约责任：任何一方违约，按成交价的 20% 向守约方支付违约金。',
        '',
        '（本模板仅用于演示，不具法律效力。）',
      ].join('\n'),
      isActive: true,
    },
  });
  const templateV2 = await prisma.contractTemplate.create({
    data: {
      name: '房屋买卖定金协议',
      version: 'V1.0',
      content: [
        '# 房屋买卖定金协议',
        '',
        '甲方（出卖人）：{{sellerName}}',
        '乙方（买受人）：{{buyerName}}',
        '',
        '一、乙方拟购买甲方位于 {{address}} 的房屋，建筑面积 {{area}} ㎡。',
        '二、双方约定成交总价人民币 {{amount}} 元，乙方支付定金 {{depositAmount}} 元。',
        '三、双方应于 {{transferDeadline}} 前签订正式买卖合同并办理过户。',
        '',
        '（本模板仅用于演示，不具法律效力。）',
      ].join('\n'),
      isActive: true,
    },
  });

  const CN_UNITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const CN_UNITS2 = ['', '十', '百', '千', '万', '十万', '百万', '千万'];
  function amountToCn(amount: number): string {
    const digits = String(amount).split('').reverse();
    let out = '';
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      const d = Number(digits[i]);
      out += CN_UNITS[d] + (CN_UNITS2[i] ?? '');
    }
    return out.replace(/零+/g, '零').replace(/零$/, '') || '零';
  }

  // ---------- 合同 ----------
  const signedListings = listings.filter((l) => l.status === 'signed');
  const availableCustomers = customers.filter((c) => c.type === 'buyer');
  const sellerCustomers = customers.filter((c) => c.type === 'seller');
  const contracts = [];
  for (let i = 0; i < 12; i += 1) {
    const signStatus = i < 7 ? 'signed' : i < 10 ? 'pending' : 'draft';
    const listing = signStatus === 'signed' ? signedListings[i] : listings[i % 40];
    const buyerCustomer = availableCustomers[i % availableCustomers.length];
    const sellerCustomer = sellerCustomers[i % sellerCustomers.length];
    const amount = listing.totalPrice;
    const commissionRate = pick([0.01, 0.015, 0.02, 0.025]);
    const commissionAmount = Math.round(amount * commissionRate);
    const depositAmount = Math.round(amount * 0.05);
    const signedAt = signStatus === 'signed' ? dayjs(listing.soldAt ?? daysAgo(20)).subtract(randInt(0, 3), 'day').toDate() : null;
    const contract = await prisma.contract.create({
      data: {
        code: `HT${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        listingId: listing.id,
        buyerCustomerId: buyerCustomer.id,
        sellerCustomerId: sellerCustomer.id,
        templateId: i % 3 === 0 ? templateV2.id : templateV1.id,
        agentId: listing.agentId,
        agencyId: listing.agencyId,
        amount,
        commissionRate,
        commissionAmount,
        depositAmount,
        signStatus,
        signMethod: signStatus === 'signed' ? 'esign_mock' : null,
        esignNo: signStatus === 'signed' ? `ESIGN-${dayjs().format('YYYY')}-${pad(i + 1, 6)}` : null,
        contentSnapshot:
          signStatus === 'signed'
            ? `# 江州市存量房屋买卖合同\n\n房屋：${listing.title}\n成交价：${amount} 元\n佣金：${commissionAmount} 元`
            : '',
        signedAt,
        createdAt: daysAgo(randInt(10, 60)),
      },
    });
    contracts.push(contract);

    // 交易进度节点：5 个（面签/贷款审批/缴税/过户/交房）
    const nodeDefs = [
      { type: 'sign', order: 1 },
      { type: 'loan', order: 2 },
      { type: 'tax', order: 3 },
      { type: 'transfer', order: 4 },
      { type: 'handover', order: 5 },
    ];
    // 已签署合同推进 1~4 个节点；待签署/草稿全部待办
    const doneCount = signStatus === 'signed' ? randInt(1, 4) : 0;
    for (let k = 0; k < nodeDefs.length; k += 1) {
      const node = nodeDefs[k];
      const status = k < doneCount ? 'done' : k === doneCount && signStatus === 'signed' ? 'doing' : 'todo';
      await prisma.transactionProgress.create({
        data: {
          contractId: contract.id,
          nodeType: node.type,
          status,
          sortOrder: node.order,
          plannedDate: dayjs(signedAt ?? new Date()).add((k + 1) * 7, 'day').toDate(),
          completedAt: status === 'done' ? dayjs(signedAt ?? new Date()).add(k * 5 + 1, 'day').toDate() : null,
          operatorId: status !== 'todo' ? agentUsers[0].id : null,
          remark: status === 'done' ? '材料齐全，流程正常' : null,
        },
      });
    }

    // 资金记录（已签署合同）
    if (signStatus === 'signed') {
      const paidDays = randInt(1, 20);
      await prisma.paymentRecord.create({
        data: {
          contractId: contract.id,
          type: 'deposit',
          amount: depositAmount,
          status: 'paid',
          tradeNo: `PAY${dayjs().format('YYYY')}${pad(i * 4 + 1, 8)}`,
          paidAt: dayjs(signedAt ?? new Date()).add(1, 'day').toDate(),
        },
      });
      await prisma.paymentRecord.create({
        data: {
          contractId: contract.id,
          type: 'down_payment',
          amount: Math.round((amount - depositAmount) * 0.3),
          status: 'paid',
          tradeNo: `PAY${dayjs().format('YYYY')}${pad(i * 4 + 2, 8)}`,
          paidAt: dayjs(signedAt ?? new Date()).add(paidDays, 'day').toDate(),
        },
      });
      await prisma.paymentRecord.create({
        data: {
          contractId: contract.id,
          type: 'balance',
          amount: Math.round((amount - depositAmount) * 0.7),
          status: 'unpaid',
          tradeNo: `PAY${dayjs().format('YYYY')}${pad(i * 4 + 3, 8)}`,
        },
      });
      await prisma.paymentRecord.create({
        data: {
          contractId: contract.id,
          type: 'commission',
          amount: commissionAmount,
          status: i % 3 === 0 ? 'unpaid' : 'paid',
          tradeNo: `PAY${dayjs().format('YYYY')}${pad(i * 4 + 4, 8)}`,
          paidAt: i % 3 === 0 ? null : dayjs(signedAt ?? new Date()).add(paidDays + 2, 'day').toDate(),
        },
      });
    }

    // 合同附件
    await prisma.attachment.create({
      data: {
        bizType: 'contract',
        bizId: contract.id,
        fileName: `${contract.code}-房屋买卖合同.pdf`,
        filePath: `/mock/contracts/${contract.code}.pdf`,
        fileSize: randInt(180, 460) * 1024,
        mimeType: 'application/pdf',
        uploadedBy: listing.agentId,
      },
    });
  }

  // 房源委托协议 / 产权照片附件
  for (let i = 0; i < 12; i += 1) {
    const listing = listings[i];
    await prisma.attachment.create({
      data: {
        bizType: 'listing_agreement',
        bizId: listing.id,
        fileName: `${listing.code}-房屋出售委托协议.pdf`,
        filePath: `/mock/agreements/${listing.code}.pdf`,
        fileSize: randInt(120, 320) * 1024,
        mimeType: 'application/pdf',
        uploadedBy: listing.agentId,
      },
    });
  }

  // ---------- 审批申请（演示：在售调价审批） ----------
  const managerByAgency = new Map<string, { id: string; name: string }>();
  stores.forEach((store, index) => {
    managerByAgency.set(store.id, { id: managers[index].id, name: managers[index].name });
  });
  const agentUserById = new Map(agentUsers.map((item) => [item.id, item]));
  const onSaleListings = listings.filter((item) => item.status === 'on_sale');
  const approvalSeeds: Array<{ index: number; status: 'pending' | 'approved' | 'rejected'; delta: number; reason: string }> = [
    { index: 0, status: 'pending', delta: -0.03, reason: '业主急售，申请下调挂牌价 3%' },
    { index: 4, status: 'pending', delta: -0.02, reason: '同户型近期成交价偏低，申请调价' },
    { index: 9, status: 'pending', delta: 0.02, reason: '小区新增地铁规划，申请上调挂牌价' },
    { index: 2, status: 'approved', delta: -0.05, reason: '挂牌 60 天未成交，申请降价促成交' },
    { index: 6, status: 'approved', delta: -0.04, reason: '客户议价，申请调整挂牌价' },
    { index: 12, status: 'rejected', delta: -0.12, reason: '大幅降价，申请快速成交' },
  ];
  const approvalReviewComments: Record<string, string> = {
    approved: '同意调价，请同步告知意向客户并更新带看反馈。',
    rejected: '降幅过大，请补充近期带看与成交对比后再提交。',
  };
  for (let i = 0; i < approvalSeeds.length; i += 1) {
    const seedItem = approvalSeeds[i];
    const listing = onSaleListings[seedItem.index % onSaleListings.length];
    const agent = agents.find((item) => item.id === listing.agentId) as (typeof agents)[number];
    const requester = agentUserById.get(agent.userId) as (typeof agentUsers)[number];
    const oldTotalPrice = listing.totalPrice;
    const newTotalPrice =
      seedItem.status === 'approved'
        ? oldTotalPrice
        : Math.round((oldTotalPrice * (1 + seedItem.delta)) / 1000) * 1000;
    const approver = managerByAgency.get(listing.agencyId);
    const reviewedAt = seedItem.status === 'pending' ? null : daysAgo(randInt(3, 20));
    await prisma.approvalRequest.create({
      data: {
        code: `AP${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        type: 'price_change',
        status: seedItem.status,
        listingId: listing.id,
        requesterId: requester.id,
        requesterName: requester.name,
        approverId: seedItem.status === 'pending' ? null : approver?.id ?? null,
        approverName: seedItem.status === 'pending' ? null : approver?.name ?? null,
        payloadJson: JSON.stringify({
          oldTotalPrice,
          newTotalPrice,
          oldUnitPrice: listing.unitPrice,
          newUnitPrice: Math.round(newTotalPrice / listing.area),
          reason: seedItem.reason,
        }),
        reason: seedItem.reason,
        reviewComment: seedItem.status === 'pending' ? null : approvalReviewComments[seedItem.status] ?? null,
        reviewedAt,
        createdAt: daysAgo(randInt(6, 30)),
      },
    });
  }

  // ---------- 房源在线咨询（C 端留言 → 经纪人回复） ----------
  const consultationContents = [
    '请问这套房源还在售吗？周末方便看房吗？',
    '房子满几年了？税费大概多少？',
    '小区停车位紧张吗？物业费多少？',
    '价格还有商量空间吗？全款可以优惠吗？',
    '这栋楼是几梯几户？采光怎么样？',
    '附近有地铁规划吗？通勤到高新区要多久？',
    '业主为什么卖房？可以配合贷款吗？',
    '能发一下户型图和小区环境照片吗？',
  ];
  const consultReplyContents = [
    '您好，房源在售，周末可以安排看房，我稍后与您确认具体时间。',
    '您好，业主满五唯一，契税可按首套核算，详细清单我整理后发您。',
    '小区地下车位配比 1:1，物业费 3.2 元/㎡/月，居住体验不错。',
    '价格有一定空间，建议先看房后与业主面谈，我可以帮您争取。',
    '两梯四户，南北通透，采光从上午十点到下午四点。',
    '附近规划有地铁 7 号线站点，预计 2027 年通车，通勤约 25 分钟。',
    '业主置换出售，可以配合贷款，具体首付比例按银行政策执行。',
    '已为您准备户型图和小区的实拍图，稍后通过消息发给您。',
  ];
  for (let i = 0; i < 10; i += 1) {
    const listing = onSaleListings[(i * 3 + 1) % onSaleListings.length];
    const agent = agents.find((item) => item.id === listing.agentId) as (typeof agents)[number];
    const fromUser = buyerUsers[i % buyerUsers.length];
    const replied = i % 3 !== 0;
    await prisma.consultation.create({
      data: {
        code: `ZX${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        listingId: listing.id,
        fromUserId: fromUser.id,
        toUserId: agent.userId,
        content: consultationContents[i % consultationContents.length],
        replyContent: replied ? consultReplyContents[i % consultReplyContents.length] : null,
        repliedAt: replied ? daysAgo(randInt(1, 10)) : null,
        status: replied ? 'replied' : 'pending',
        createdAt: daysAgo(randInt(3, 20)),
      },
    });
  }

  // ---------- 通知 ----------
  const notifUsers = [...buyerUsers, ...sellerUsers, ...agentUsers, ...managers];
  for (let i = 0; i < 40; i += 1) {
    const user = notifUsers[i % notifUsers.length];
    const type = pick(['showing', 'contract', 'progress', 'system']);
    const templates: Record<string, { title: string; content: string }> = {
      showing: { title: '带看预约提醒', content: '您有一条新的带看预约，请及时确认。' },
      contract: { title: '合同签署通知', content: '您的房屋买卖合同已进入签署流程。' },
      progress: { title: '交易进度更新', content: '您的交易已推进至下一节点，请查看详情。' },
      system: { title: '系统公告', content: '平台将于每周日凌晨进行例行维护。' },
    };
    await prisma.notification.create({
      data: {
        userId: user.id,
        type,
        title: templates[type].title,
        content: templates[type].content,
        isRead: i % 3 === 0,
        bizType: type,
        bizId: null,
        createdAt: daysAgo(randInt(1, 30)),
      },
    });
  }

  // ---------- 操作日志 ----------
  const actions = ['login', 'create_listing', 'update_listing', 'create_showing', 'sign_contract', 'verify_listing', 'approve_realname'];
  for (let i = 0; i < 50; i += 1) {
    await prisma.operationLog.create({
      data: {
        userId: pick([admin.id, finance.id, ...agentUsers.map((u) => u.id)]),
        action: pick(actions),
        targetType: pick(['listing', 'contract', 'showing', 'user']),
        targetId: listings[i % listings.length].id,
        detail: JSON.stringify({ note: '演示环境操作日志' }),
        ip: `192.168.1.${randInt(2, 240)}`,
        createdAt: daysAgo(randInt(1, 60)),
      },
    });
  }

  console.log('[seed] 完成：');
  console.log(`  用户 ${await prisma.user.count()} / 实名 ${await prisma.realNameAuth.count()}`);
  console.log(`  机构门店 ${await prisma.agency.count()} / 经纪人 ${await prisma.agent.count()}`);
  console.log(`  小区 ${await prisma.community.count()} / 房源 ${await prisma.houseListing.count()}`);
  console.log(`  客户 ${await prisma.customer.count()} / 带看 ${await prisma.showing.count()}`);
  console.log(`  合同 ${await prisma.contract.count()} / 进度节点 ${await prisma.transactionProgress.count()}`);
  console.log(`  资金记录 ${await prisma.paymentRecord.count()} / 通知 ${await prisma.notification.count()}`);
  console.log(`  操作日志 ${await prisma.operationLog.count()} / 字典 ${await prisma.dataDict.count()}`);
  console.log(`  价格历史 ${await prisma.priceHistory.count()} / 审批 ${await prisma.approvalRequest.count()} / 咨询 ${await prisma.consultation.count()}`);
}

main()
  .catch((error) => {
    console.error('[seed] 失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
