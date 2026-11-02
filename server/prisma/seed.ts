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
  await prisma.customerFollowUp.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.roleMenuConfig.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.approvalFlowConfig.deleteMany();
  await prisma.commissionAllocation.deleteMany();
  await prisma.commissionSettlement.deleteMany();
  await prisma.registrationApplication.deleteMany();
  await prisma.transferAppointment.deleteMany();
  await prisma.taxRecord.deleteMany();
  await prisma.materialChecklist.deleteMany();
  await prisma.escrowTransaction.deleteMany();
  await prisma.escrowAccount.deleteMany();
  await prisma.appraisalOrder.deleteMany();
  await prisma.loanApplication.deleteMany();
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

  // ---------- E2：交易后链路（贷款/评估/资金监管/过户材料/税费/预约/登记/佣金） ----------
  const signedContracts = contracts.filter((item) => item.signStatus === 'signed');
  const agentById = new Map(agents.map((item) => [item.id, item]));
  const agentUserMap = new Map(agentUsers.map((item) => [item.id, item]));
  const agencyNameById = new Map([[hq.id, hq.name], ...stores.map((item) => [item.id, item.name] as const)]);
  const storeIndexById = new Map(stores.map((item, index) => [item.id, index]));
  const bankNames = ['江州银行·城东支行', '江州农商行·高新支行', '江城银行·滨江支行'];
  const appraisalInstitutions = ['江城正衡评估有限公司', '江州华信评估事务所'];
  const materialNames = ['网签买卖合同', '买卖双方身份证', '户口本', '婚姻状况证明', '不动产权证', '完税凭证'];

  for (let i = 0; i < signedContracts.length; i += 1) {
    const contract = signedContracts[i];
    const listing = listings.find((item) => item.id === contract.listingId) as (typeof listings)[number];
    const agent = agentById.get(contract.agentId) as (typeof agents)[number];
    const agentUser = agentUserMap.get(agent.userId) as (typeof agentUsers)[number];
    const nodes = await prisma.transactionProgress.findMany({ where: { contractId: contract.id } });
    const doneCount = nodes.filter((node) => node.status === 'done').length;
    const signedAt = contract.signedAt ?? daysAgo(20);
    const storeIndex = storeIndexById.get(contract.agencyId) ?? 0;
    const manager = managers[storeIndex % managers.length];

    // 贷款（前 4 单）：状态覆盖已放款/已批贷/已提交/已拒绝
    let loanId: string | null = null;
    if (i < 4) {
      const statuses = ['disbursed', 'approved', 'submitted', 'rejected'] as const;
      const status = statuses[i];
      const loanAmount = Math.round(contract.amount * 0.65);
      const submittedAt = dayjs(signedAt).add(1, 'day').toDate();
      const approvedAt = status === 'approved' || status === 'disbursed' ? dayjs(signedAt).add(6, 'day').toDate() : null;
      const loan = await prisma.loanApplication.create({
        data: {
          code: `LOAN${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
          contractId: contract.id,
          bankName: bankNames[i % bankNames.length],
          productName: ['个人二手住房按揭贷', '公积金组合贷', '个人二手住房按揭贷', '个人二手住房按揭贷'][i % 4],
          amount: loanAmount,
          termMonths: [240, 360, 300, 240][i % 4],
          annualRate: Number((3.85 + i * 0.1).toFixed(2)),
          status,
          documentsJson: JSON.stringify([
            { name: '身份证', status: 'verified' },
            { name: '收入证明', status: status === 'submitted' ? 'uploaded' : 'verified' },
            { name: '银行流水', status: status === 'submitted' ? 'pending' : 'verified' },
            { name: '征信授权书', status: 'verified' },
          ]),
          rejectReason: status === 'rejected' ? '近半年存在逾期记录，暂不符合准入' : null,
          submittedAt,
          approvedAt,
          disbursedAt: status === 'disbursed' ? dayjs(signedAt).add(12, 'day').toDate() : null,
        },
      });
      loanId = loan.id;
      await prisma.appraisalOrder.create({
        data: {
          code: `PG${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
          contractId: contract.id,
          loanId: loan.id,
          institutionName: appraisalInstitutions[i % appraisalInstitutions.length],
          appraiserName: ['评估师·吴工', '评估师·郑工'][i % 2],
          appointmentAt: dayjs(signedAt).add(2, 'day').toDate(),
          status: status === 'submitted' ? 'visiting' : status === 'rejected' ? 'reported' : 'reported',
          appraisedValue: status === 'submitted' ? null : contract.amount,
          reportNo: status === 'submitted' ? null : `PGBG${dayjs().format('YYYY')}${pad(i + 1, 5)}`,
          fee: 800,
        },
      });
    }

    // 资金监管账户 + 流水（所有已签署合同）
    const depositPaid = Math.round(contract.amount * 0.3);
    const released = doneCount >= 4 ? Math.round(contract.amount * 0.2) : 0;
    const releaseSum = (doneCount >= 2 ? Math.round(contract.amount * 0.1) : 0) + (doneCount >= 4 ? Math.round(contract.amount * 0.1) : 0);
    const escrow = await prisma.escrowAccount.create({
      data: {
        code: `ESC${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        contractId: contract.id,
        bankName: bankNames[i % bankNames.length],
        accountNoMasked: `6222 **** **** ${pad(1200 + i, 4)}`,
        agreementNo: `JGXY${dayjs().format('YYYY')}${pad(i + 1, 4)}`,
        totalAmount: contract.amount,
        releasedAmount: releaseSum,
        status: doneCount >= 4 ? 'released' : 'active',
      },
    });
    await prisma.escrowTransaction.create({
      data: {
        escrowId: escrow.id,
        type: 'deposit',
        amount: depositPaid,
        tradeNo: `ESC${dayjs().format('YYYY')}${pad(i * 5 + 1, 8)}`,
        remark: '买方首付款存入监管账户',
        createdAt: dayjs(signedAt).add(2, 'day').toDate(),
      },
    });
    if (doneCount >= 2) {
      await prisma.escrowTransaction.create({
        data: {
          escrowId: escrow.id,
          type: 'release',
          amount: Math.round(contract.amount * 0.1),
          nodeType: 'tax',
          tradeNo: `ESC${dayjs().format('YYYY')}${pad(i * 5 + 2, 8)}`,
          remark: '缴税节点完成，解冻部分资金用于缴税',
          createdAt: dayjs(signedAt).add(8, 'day').toDate(),
        },
      });
    }
    if (released > 0) {
      await prisma.escrowTransaction.create({
        data: {
          escrowId: escrow.id,
          type: 'release',
          amount: Math.round(contract.amount * 0.1),
          nodeType: 'transfer',
          tradeNo: `ESC${dayjs().format('YYYY')}${pad(i * 5 + 3, 8)}`,
          remark: '过户完成，解冻尾款',
          createdAt: dayjs(signedAt).add(20, 'day').toDate(),
        },
      });
      await prisma.escrowTransaction.create({
        data: {
          escrowId: escrow.id,
          type: 'transfer',
          amount: released,
          tradeNo: `ESC${dayjs().format('YYYY')}${pad(i * 5 + 4, 8)}`,
          remark: '解冻资金划转卖方账户',
          createdAt: dayjs(signedAt).add(21, 'day').toDate(),
        },
      });
    }

    // 过户材料清单
    for (let m = 0; m < materialNames.length; m += 1) {
      const status = m < Math.max(1, doneCount + 1) ? 'verified' : m < doneCount + 3 ? 'uploaded' : 'pending';
      await prisma.materialChecklist.create({
        data: {
          contractId: contract.id,
          name: materialNames[m],
          status,
          remark: status === 'verified' ? '已核验' : status === 'uploaded' ? '待核验' : null,
        },
      });
    }

    // 税费（契税/增值税/个税）
    const taxes = [
      { taxType: 'deed', amount: Math.round(contract.amount * 0.015) },
      { taxType: 'vat', amount: Math.round(contract.amount * 0.053) },
      { taxType: 'income', amount: Math.round(contract.amount * 0.01) },
    ];
    for (let t = 0; t < taxes.length; t += 1) {
      const paid = doneCount >= 3;
      await prisma.taxRecord.create({
        data: {
          contractId: contract.id,
          taxType: taxes[t].taxType,
          amount: taxes[t].amount,
          status: paid ? 'paid' : 'pending',
          receiptNo: paid ? `WS${dayjs().format('YYYY')}${pad(i * 3 + t + 1, 6)}` : null,
          paidAt: paid ? dayjs(signedAt).add(10 + t, 'day').toDate() : null,
        },
      });
    }

    // 政务预约（缴税 + 过户）
    await prisma.transferAppointment.create({
      data: {
        code: `YY${dayjs().format('YYYY')}${pad(i * 2 + 1, 6)}`,
        contractId: contract.id,
        type: 'tax',
        appointmentAt: dayjs(signedAt).add(9, 'day').toDate(),
        hallName: '江州市政务服务中心·税务窗口',
        appointmentNo: `SW${dayjs(signedAt).format('YYYYMMDD')}${pad(i + 1, 4)}`,
        status: doneCount >= 3 ? 'done' : 'booked',
      },
    });
    await prisma.transferAppointment.create({
      data: {
        code: `YY${dayjs().format('YYYY')}${pad(i * 2 + 2, 6)}`,
        contractId: contract.id,
        type: 'transfer',
        appointmentAt: dayjs(signedAt).add(16, 'day').toDate(),
        hallName: '江州市不动产登记中心·城东大厅',
        appointmentNo: `BDC${dayjs(signedAt).format('YYYYMMDD')}${pad(i + 1, 4)}`,
        status: doneCount >= 4 ? 'done' : 'booked',
      },
    });

    // 不动产登记
    const registrationStatus = doneCount >= 4 ? 'registered' : doneCount >= 3 ? 'accepted' : 'submitted';
    await prisma.registrationApplication.create({
      data: {
        code: `REG${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        contractId: contract.id,
        status: registrationStatus,
        acceptNo: registrationStatus === 'submitted' ? null : `SL${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        acceptedAt: registrationStatus === 'submitted' ? null : dayjs(signedAt).add(17, 'day').toDate(),
        completedAt: registrationStatus === 'registered' ? dayjs(signedAt).add(25, 'day').toDate() : null,
        remark: registrationStatus === 'registered' ? '已登簿，等待领证' : null,
      },
    });

    // 佣金结算（分摊合计 = 佣金总额）
    const totalCommission = contract.commissionAmount;
    const allocations: Array<{ role: string; name: string; rate: number }> = [
      { role: 'listing_agent', name: agentUser.name, rate: 0.6 },
      { role: 'co_agent', name: `${agentUser.name}协作`, rate: 0.15 },
      { role: 'store', name: agencyNameById.get(contract.agencyId) ?? '门店', rate: 0.2 },
      { role: 'finance', name: '财务专员·邱丽', rate: 0.05 },
    ];
    const commissionAmounts = allocations.map((item) => Math.round(totalCommission * item.rate));
    commissionAmounts[commissionAmounts.length - 1] = totalCommission - commissionAmounts.slice(0, -1).reduce((sum, item) => sum + item, 0);
    const settlementStatus = i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'confirmed' : 'pending';
    const settlement = await prisma.commissionSettlement.create({
      data: {
        code: `CM${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        contractId: contract.id,
        ruleName: '标准佣金分成规则 V1.0',
        baseAmount: contract.amount,
        totalCommission,
        status: settlementStatus,
        confirmedAt: settlementStatus === 'pending' ? null : dayjs(signedAt).add(28, 'day').toDate(),
        paidAt: settlementStatus === 'paid' ? dayjs(signedAt).add(30, 'day').toDate() : null,
        allocations: {
          create: allocations.map((item, index) => ({
            role: item.role,
            name: item.name,
            rate: item.rate,
            amount: commissionAmounts[index],
          })),
        },
      },
    });
    void manager;
    void settlement;
    void loanId;
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

  // ---------- E3：佣金规则 / 审批流配置 ----------
  await prisma.commissionRule.create({
    data: { name: '标准佣金分成规则 V1.0', active: true, agentRate: 0.6, coAgentRate: 0.15, storeRate: 0.2, platformRate: 0.05 },
  });
  for (const type of ['price_change', 'contract_void']) {
    await prisma.approvalFlowConfig.create({ data: { type, mode: 'single' } });
  }

  // ---------- E4：客户跟进 / 投诉 / 角色菜单 / 合同补充条款 ----------
  const followUpContents = [
    '电话回访：客户预算与需求已确认，重点推荐城东区两居。',
    '带看后回访：客户对采光满意，但认为总价偏高，已反馈业主。',
    '微信沟通：客户希望周末再看两套同小区房源。',
    '业主沟通：业主同意小幅议价，需客户确认付款方式。',
    '客户资料补充：已核验购房资格与贷款预审额度。',
  ];
  for (let i = 0; i < 20; i += 1) {
    const customer = customers[i % customers.length];
    const agent = agents.find((item) => item.id === customer.agentId) as (typeof agents)[number];
    const agentUser = agentUsers.find((item) => item.id === agent.userId) as (typeof agentUsers)[number];
    await prisma.customerFollowUp.create({
      data: {
        customerId: customer.id,
        content: followUpContents[i % followUpContents.length],
        nextAction: ['安排二次带看', '等待客户确认', '与业主议价', '协助办理贷款预审'][i % 4],
        nextFollowAt: i % 2 === 0 ? dayjs().add(randInt(1, 10), 'day').toDate() : null,
        createdById: agentUser.id,
        createdByName: agentUser.name,
        createdAt: daysAgo(randInt(1, 20)),
      },
    });
  }

  const complaints: Array<{ type: string; status: string; content: string }> = [
    { type: 'listing_quality', status: 'pending', content: '房源照片与实勘不符，客厅采光明显偏暗，希望核实。' },
    { type: 'false_info', status: 'pending', content: '该房源已售但仍在展示，请下架并更新状态。' },
    { type: 'service', status: 'processing', content: '经纪人回复较慢，预约看房后未按约定时间联系。' },
    { type: 'price', status: 'resolved', content: '同一房源在不同平台挂牌价不一致，已确认以平台价为准。' },
    { type: 'listing_quality', status: 'resolved', content: '房屋渗水问题已在委托协议中补充说明，感谢平台跟进。' },
    { type: 'other', status: 'rejected', content: '希望平台提供装修贷款服务（非平台业务范围）。' },
  ];
  for (let i = 0; i < complaints.length; i += 1) {
    const complaint = complaints[i];
    const handled = complaint.status !== 'pending';
    await prisma.complaint.create({
      data: {
        code: `TS${dayjs().format('YYYY')}${pad(i + 1, 6)}`,
        type: complaint.type,
        content: complaint.content,
        contactName: (buyerUsers[i % buyerUsers.length] as (typeof buyerUsers)[number]).name,
        contactPhone: (buyerUsers[i % buyerUsers.length] as (typeof buyerUsers)[number]).phone,
        listingId: listings[i % listings.length].id,
        complainantUserId: (buyerUsers[i % buyerUsers.length] as (typeof buyerUsers)[number]).id,
        status: complaint.status,
        handlerId: handled ? admin.id : null,
        handlerName: handled ? admin.name : null,
        handleComment: handled
          ? complaint.status === 'resolved'
            ? '已联系经纪人核实并回访客户，问题已解决。'
            : complaint.status === 'processing'
              ? '已转交门店店长处理，预计 24 小时内反馈。'
              : '该诉求不在平台服务范围内，已向客户说明。'
          : null,
        handledAt: handled ? daysAgo(randInt(1, 6)) : null,
        createdAt: daysAgo(randInt(2, 15)),
      },
    });
  }

  const roleMenus: Record<string, string[]> = {
    agent: ['/admin', '/admin/listings', '/admin/approvals', '/admin/consultations', '/admin/customers', '/admin/showings', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers'],
    store_manager: ['/admin', '/admin/listings', '/admin/approvals', '/admin/consultations', '/admin/customers', '/admin/showings', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers', '/admin/commissions', '/admin/agencies', '/admin/stats'],
    finance: ['/admin', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers', '/admin/commissions', '/admin/finance', '/admin/stats'],
    admin: ['/admin', '/admin/listings', '/admin/approvals', '/admin/consultations', '/admin/communities', '/admin/customers', '/admin/showings', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers', '/admin/commissions', '/admin/agencies', '/admin/stats', '/admin/audit', '/admin/logs', '/admin/users', '/admin/complaints', '/admin/dicts', '/admin/templates'],
  };
  for (const [role, keys] of Object.entries(roleMenus)) {
    await prisma.roleMenuConfig.create({ data: { role, menuKeysJson: JSON.stringify(keys) } });
  }

  for (let i = 0; i < signedContracts.length; i += 1) {
    const contract = signedContracts[i];
    await prisma.contract.update({
      where: { id: contract.id },
      data: { customTerms: i % 2 === 0 ? '补充条款：交房前房屋内固定装修及家电家具按现状保留，具体以《交房清单》为准。' : '' },
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
  console.log(`  贷款 ${await prisma.loanApplication.count()} / 评估 ${await prisma.appraisalOrder.count()} / 监管账户 ${await prisma.escrowAccount.count()}（流水 ${await prisma.escrowTransaction.count()}）`);
  console.log(`  材料 ${await prisma.materialChecklist.count()} / 税费 ${await prisma.taxRecord.count()} / 预约 ${await prisma.transferAppointment.count()} / 登记 ${await prisma.registrationApplication.count()} / 佣金 ${await prisma.commissionSettlement.count()}（分摊 ${await prisma.commissionAllocation.count()}）`);
  console.log(`  佣金规则 ${await prisma.commissionRule.count()} / 审批流配置 ${await prisma.approvalFlowConfig.count()}`);
  console.log(`  客户跟进 ${await prisma.customerFollowUp.count()} / 投诉 ${await prisma.complaint.count()} / 角色菜单 ${await prisma.roleMenuConfig.count()}`);
}

main()
  .catch((error) => {
    console.error('[seed] 失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
