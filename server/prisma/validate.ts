// 种子数据质量校验：编码、金额、关系、状态机、日期、唯一性、数量、隐私。
// 任一失败即退出码 1；由 db:reset 自动执行。
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const failures: string[] = [];
let checked = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checked += 1;
  if (!condition) failures.push(`${name}${detail ? `：${detail}` : ''}`);
}

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
function isValidIdCard(id: string): boolean {
  if (!/^\d{17}[\dX]$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * ID_WEIGHTS[i];
  return ID_CHECK[sum % 11] === id[17];
}

async function main(): Promise<void> {
  const [users, realNames, agencies, agents, communities, listings, customers, showings, contracts, progresses, payments, dicts, priceHistories, approvals, consultations, loans, appraisals, escrows, escrowTransactions, materials, taxes, appointments, registrations, commissions, allocations] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.realNameAuth.findMany(),
      prisma.agency.findMany(),
      prisma.agent.findMany({ include: { user: true } }),
      prisma.community.findMany(),
      prisma.houseListing.findMany(),
      prisma.customer.findMany(),
      prisma.showing.findMany(),
      prisma.contract.findMany(),
      prisma.transactionProgress.findMany(),
      prisma.paymentRecord.findMany(),
      prisma.dataDict.findMany(),
      prisma.priceHistory.findMany(),
      prisma.approvalRequest.findMany(),
      prisma.consultation.findMany(),
      prisma.loanApplication.findMany(),
      prisma.appraisalOrder.findMany(),
      prisma.escrowAccount.findMany(),
      prisma.escrowTransaction.findMany(),
      prisma.materialChecklist.findMany(),
      prisma.taxRecord.findMany(),
      prisma.transferAppointment.findMany(),
      prisma.registrationApplication.findMany(),
      prisma.commissionSettlement.findMany(),
      prisma.commissionAllocation.findMany(),
    ]);

  // ---------- 数量 ----------
  const expected: Array<[string, number, number]> = [
    ['用户', users.length, 36],
    ['机构/门店', agencies.length, 6],
    ['经纪人', agents.length, 12],
    ['小区', communities.length, 15],
    ['房源', listings.length, 60],
    ['客户', customers.length, 30],
    ['带看', showings.length, 45],
    ['合同', contracts.length, 12],
    ['进度节点', progresses.length, 60],
  ];
  for (const [name, actual, want] of expected) {
    check(`数量.${name}`, Math.abs(actual - want) <= Math.ceil(want * 0.1), `实际 ${actual}，期望 ${want}（±10%）`);
  }

  // ---------- 编码规则与唯一性 ----------
  const listingCodes = new Set(listings.map((l) => l.code));
  check('编码.房源编号格式', listings.every((l) => /^FC-901-\d{6}$/.test(l.code)));
  check('唯一性.房源编号', listingCodes.size === listings.length);
  check('编码.合同编号格式', contracts.every((c) => /^HT\d{10}$/.test(c.code)));
  check('唯一性.合同编号', new Set(contracts.map((c) => c.code)).size === contracts.length);
  check('编码.带看单号格式', showings.every((s) => /^DK\d{12}$/.test(s.code)));
  check('唯一性.带看单号', new Set(showings.map((s) => s.code)).size === showings.length);
  check('编码.客户编号格式', customers.every((c) => /^KH-\d{6}$/.test(c.code)));
  check('唯一性.客户编号', new Set(customers.map((c) => c.code)).size === customers.length);

  // ---------- 手机号 / 身份证 ----------
  check('格式.用户手机号', users.every((u) => /^1[3-9]\d{9}$/.test(u.phone)), users.filter((u) => !/^1[3-9]\d{9}$/.test(u.phone)).map((u) => u.phone).join(','));
  check('唯一性.用户手机号', new Set(users.map((u) => u.phone)).size === users.length);
  check('格式.客户手机号', customers.every((c) => /^1[3-9]\d{9}$/.test(c.phone)));
  check('格式.身份证脱敏', realNames.every((r) => /^\d{6}\*{8}\d{3}[\dX]$/.test(r.idCardMasked)), realNames.find((r) => !/^\d{6}\*{8}\d{3}[\dX]$/.test(r.idCardMasked))?.idCardMasked ?? '');
  check('校验位.身份证', realNames.every((r) => isValidIdCard(r.idCardHash)), realNames.find((r) => !isValidIdCard(r.idCardHash))?.idCardHash ?? '');
  check('唯一性.身份证', new Set(realNames.map((r) => r.idCardHash)).size === realNames.length);
  check('隐私.无真实品牌', agencies.every((a) => a.name.includes('安家')));

  // ---------- 金额自洽 ----------
  let priceMismatch = 0;
  for (const l of listings) {
    // 房源总价按 1000 元取整：总价 = round(单价 × 面积 / 1000) × 1000
    const expectedTotal = Math.round((l.unitPrice * l.area) / 1000) * 1000;
    if (expectedTotal !== l.totalPrice) priceMismatch += 1;
  }
  check('金额.房源总价=单价×面积', priceMismatch === 0, `不一致 ${priceMismatch} 条`);
  let commissionMismatch = 0;
  for (const c of contracts) {
    if (c.commissionAmount !== Math.round(c.amount * c.commissionRate)) commissionMismatch += 1;
    if (c.commissionRate < 0.005 || c.commissionRate > 0.03) commissionMismatch += 1;
  }
  check('金额.佣金=合同金额×佣金率(0.5%~3%)', commissionMismatch === 0, `不一致 ${commissionMismatch} 条`);
  check('金额.合同金额=房源总价', contracts.every((c) => {
    const listing = listings.find((l) => l.id === c.listingId);
    return listing ? listing.totalPrice === c.amount : false;
  }));
  check('金额.定金>0', contracts.every((c) => c.depositAmount > 0));

  // ---------- 关系一致 ----------
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const customerById = new Map(customers.map((c) => [c.id, c]));
  check('关系.房源机构=经纪人机构', listings.every((l) => agentById.get(l.agentId)?.agencyId === l.agencyId));
  check('关系.带看经纪人与房源一致', showings.every((s) => listings.find((l) => l.id === s.listingId)?.agentId === s.agentId));
  check('关系.带看客户与门店一致', showings.every((s) => {
    const listing = listings.find((l) => l.id === s.listingId);
    const customer = customerById.get(s.customerId);
    return Boolean(listing && customer && customer.agencyId === listing.agencyId);
  }));
  check('关系.合同与房源/客户类型', contracts.every((c) => {
    const buyer = customerById.get(c.buyerCustomerId);
    const seller = customerById.get(c.sellerCustomerId);
    return buyer?.type === 'buyer' && seller?.type === 'seller';
  }));
  check('关系.合同机构=房源机构', contracts.every((c) => {
    const listing = listings.find((l) => l.id === c.listingId);
    return listing?.agencyId === c.agencyId;
  }));
  check('关系.实名认证用户存在', realNames.every((r) => users.some((u) => u.id === r.userId)));
  check('关系.经纪人均已实名', agents.every((a) => realNames.some((r) => r.userId === a.userId && r.status === 'approved')));

  // ---------- 状态机 ----------
  const listingStatuses = new Set(['pending', 'on_sale', 'signed', 'offline']);
  const signStatuses = new Set(['draft', 'pending', 'signed', 'voided']);
  const progressStatuses = new Set(['todo', 'doing', 'done']);
  check('状态.房源状态合法', listings.every((l) => listingStatuses.has(l.status)));
  check('状态.合同状态合法', contracts.every((c) => signStatuses.has(c.signStatus)));
  check('状态.进度状态合法', progresses.every((p) => progressStatuses.has(p.status)));
  check('状态.已签署合同对应已签约房源', contracts.filter((c) => c.signStatus === 'signed').every((c) => listings.find((l) => l.id === c.listingId)?.status === 'signed'));
  check('状态.草稿/待签署合同对应在售房源', contracts.filter((c) => ['draft', 'pending'].includes(c.signStatus)).every((c) => listings.find((l) => l.id === c.listingId)?.status === 'on_sale'));
  check('状态.进度节点顺序唯一', progresses.every((p) => p.sortOrder >= 1 && p.sortOrder <= 5));
  check('状态.已签署合同有面签完成记录', contracts.filter((c) => c.signStatus === 'signed').every((c) => progresses.some((p) => p.contractId === c.id && p.nodeType === 'sign' && p.status === 'done')));

  // ---------- 日期顺序 ----------
  check('日期.更新时间>=创建时间', users.every((u) => u.updatedAt >= u.createdAt));
  check('日期.合同签署>=房源上架', contracts.filter((c) => c.signedAt).every((c) => {
    const listing = listings.find((l) => l.id === c.listingId);
    return !listing?.listedAt || (c.signedAt as Date) >= listing.listedAt;
  }));
  check('日期.进度完成>=合同签署', progresses.filter((p) => p.completedAt && p.contractId).every((p) => {
    const contract = contracts.find((c) => c.id === p.contractId);
    return !contract?.signedAt || (p.completedAt as Date) >= contract.signedAt;
  }));
  check('日期.带看实际时间>=预约时间', showings.every((s) => !s.actualAt || s.actualAt >= s.scheduledAt));

  // ---------- 软删除与字典 ----------
  check('数据.默认未软删除', listings.every((l) => !l.isDeleted) && contracts.every((c) => !c.isDeleted));
  check('字典.数量', dicts.length >= 40, `实际 ${dicts.length}`);
  check('数据.资金记录有唯一流水号', new Set(payments.map((p) => p.tradeNo)).size === payments.length);

  // ---------- 价格历史 / 审批 / 咨询（E1 增强） ----------
  const listingsById = new Map(listings.map((l) => [l.id, l]));
  check('数量.价格历史', priceHistories.length >= 100, `实际 ${priceHistories.length}`);
  check('数量.审批申请', approvals.length === 6, `实际 ${approvals.length}`);
  check('数量.在线咨询', consultations.length === 10, `实际 ${consultations.length}`);
  check('编码.审批编号格式', approvals.every((a) => /^AP\d{10}$/.test(a.code)));
  check('编码.咨询编号格式', consultations.every((c) => /^ZX\d{10}$/.test(c.code)));
  check('唯一性.审批编号', new Set(approvals.map((a) => a.code)).size === approvals.length);
  check('唯一性.咨询编号', new Set(consultations.map((c) => c.code)).size === consultations.length);
  check('价格历史.每条房源有历史', listings.filter((l) => l.status !== 'pending').every((l) => priceHistories.some((h) => h.listingId === l.id)));
  check('价格历史.最后一条=当前挂牌价', listings.filter((l) => l.status !== 'pending').every((l) => {
    const rows = priceHistories.filter((h) => h.listingId === l.id).sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    return rows.length > 0 && rows[rows.length - 1].price === l.totalPrice;
  }));
  check('价格历史.价格与单价自洽', priceHistories.every((h) => {
    const listing = listingsById.get(h.listingId);
    return Boolean(listing) && Math.abs(h.price / listing!.area - h.unitPrice) <= 1;
  }));
  check('价格历史.日期升序', priceHistories.every((h) => {
    const rows = priceHistories.filter((item) => item.listingId === h.listingId).sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    return rows.every((item, index) => index === 0 || item.changedAt >= rows[index - 1].changedAt);
  }));
  check('审批.状态合法', approvals.every((a) => ['pending', 'approved', 'rejected', 'cancelled'].includes(a.status)));
  check('审批.已审记录有审批人与时间', approvals.filter((a) => a.status !== 'pending').every((a) => Boolean(a.approverId && a.reviewedAt)));
  check('审批.待审记录无审批人', approvals.filter((a) => a.status === 'pending').every((a) => !a.approverId && !a.reviewedAt));
  check('审批.通过记录价格=当前价', approvals.filter((a) => a.status === 'approved').every((a) => {
    const listing = listingsById.get(a.listingId ?? '');
    return Boolean(listing) && JSON.parse(a.payloadJson).newTotalPrice === listing!.totalPrice;
  }));
  check('咨询.状态与回复一致', consultations.every((c) => (c.status === 'replied' ? Boolean(c.replyContent && c.repliedAt) : !c.replyContent && !c.repliedAt)));
  check('咨询.留言人与经纪人不同', consultations.every((c) => c.fromUserId !== c.toUserId));

  // ---------- E2 交易后链路（贷款/评估/监管/过户/佣金） ----------
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  check('数量.贷款申请', loans.length === 4, `实际 ${loans.length}`);
  check('数量.评估委托', appraisals.length === 4, `实际 ${appraisals.length}`);
  check('数量.监管账户', escrows.length === 7, `实际 ${escrows.length}`);
  check('数量.过户材料', materials.length === 42, `实际 ${materials.length}`);
  check('数量.税费记录', taxes.length === 21, `实际 ${taxes.length}`);
  check('数量.政务预约', appointments.length === 14, `实际 ${appointments.length}`);
  check('数量.登记申请', registrations.length === 7, `实际 ${registrations.length}`);
  check('数量.佣金结算', commissions.length === 7, `实际 ${commissions.length}`);
  check('数量.佣金分摊', allocations.length === 28, `实际 ${allocations.length}`);
  check('编码.贷款/评估/监管/预约/登记/佣金编号', loans.every((l) => /^LOAN\d{10}$/.test(l.code)) && appraisals.every((a) => /^PG\d{10}$/.test(a.code)) && escrows.every((e) => /^ESC\d{10}$/.test(e.code)) && appointments.every((a) => /^YY\d{10}$/.test(a.code)) && registrations.every((r) => /^REG\d{10}$/.test(r.code)) && commissions.every((c) => /^CM\d{10}$/.test(c.code)));
  check('唯一性.监管账户与合同一对一', new Set(escrows.map((e) => e.contractId)).size === escrows.length);
  check('关系.交易后链路归属已签署合同', [...loans, ...appraisals, ...escrows, ...materials, ...taxes, ...appointments, ...registrations, ...commissions].every((row) => contractById.get((row as { contractId: string }).contractId)?.signStatus === 'signed'));
  check('金额.贷款金额<=合同金额', loans.every((l) => Boolean(contractById.get(l.contractId)) && l.amount <= (contractById.get(l.contractId)?.amount ?? 0)));
  check('状态.贷款状态与时间一致', loans.every((l) => {
    if (l.status === 'rejected') return Boolean(l.rejectReason);
    if (['approved', 'disbursed'].includes(l.status)) return Boolean(l.approvedAt);
    if (l.status === 'disbursed') return Boolean(l.disbursedAt);
    return true;
  }));
  check('状态.评估出报告需有评估值与报告编号', appraisals.filter((a) => a.status === 'reported').every((a) => Boolean(a.appraisedValue && a.reportNo)));
  check('金额.监管解冻合计=流水解冻之和', escrows.every((e) => {
    const sum = escrowTransactions.filter((t) => t.escrowId === e.id && t.type === 'release').reduce((acc, t) => acc + t.amount, 0);
    return e.releasedAmount === sum && e.releasedAmount <= e.totalAmount;
  }));
  check('数据.每个监管账户有流水且金额>0', escrows.every((e) => escrowTransactions.filter((t) => t.escrowId === e.id).length > 0 && escrowTransactions.filter((t) => t.escrowId === e.id).every((t) => t.amount > 0)));
  check('状态.材料/税费/预约/登记状态合法', materials.every((m) => ['pending', 'uploaded', 'verified'].includes(m.status)) && taxes.every((t) => ['pending', 'paid'].includes(t.status)) && appointments.every((a) => ['booked', 'done', 'cancelled'].includes(a.status)) && registrations.every((r) => ['submitted', 'accepted', 'registered', 'completed'].includes(r.status)));
  check('数据.已缴税有完税凭证', taxes.filter((t) => t.status === 'paid').every((t) => Boolean(t.receiptNo && t.paidAt)));
  check('金额.佣金总额=合同佣金', commissions.every((c) => c.totalCommission === (contractById.get(c.contractId)?.commissionAmount ?? -1)));
  check('金额.佣金分摊合计=总额', commissions.every((c) => allocations.filter((a) => a.settlementId === c.id).reduce((sum, a) => sum + a.amount, 0) === c.totalCommission));
  check('金额.佣金分摊比例合计≈100%', commissions.every((c) => Math.abs(allocations.filter((a) => a.settlementId === c.id).reduce((sum, a) => sum + a.rate, 0) - 1) < 0.001));
  check('状态.已支付佣金有支付时间', commissions.filter((c) => c.status === 'paid').every((c) => Boolean(c.paidAt && c.confirmedAt)));

  // ---------- 结果 ----------
  if (failures.length > 0) {
    console.error(`[validate] 失败 ${failures.length} 项 / 共 ${checked} 项检查：`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`[validate] 通过 ${checked} 项检查（编码/金额/关系/状态机/日期/唯一性/数量/隐私）。`);
  }
}

main()
  .catch((error) => {
    console.error('[validate] 异常：', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
