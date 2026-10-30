import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { resolveScope } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import type { CreateContractDto, ListContractsQueryDto, UpdateProgressDto } from './dto';
import { buildContractPdf } from './contract-pdf';

const CONTRACT_INCLUDE = {
  listing: { include: { community: true } },
  buyerCustomer: true,
  sellerCustomer: true,
  template: true,
  agent: { include: { user: { select: { id: true, name: true, phone: true } } } },
  agency: true,
  progress: { orderBy: { sortOrder: 'asc' as const } },
  payments: true,
} satisfies Prisma.ContractInclude;

type ContractRow = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CN_UNIT = ['', '十', '百', '千', '万', '十万', '百万', '千万'];

function amountToCn(amount: number): string {
  const digits = String(Math.round(amount)).split('').reverse();
  let out = '';
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    out += CN_NUM[Number(digits[i])] + (CN_UNIT[i] ?? '');
  }
  return out.replace(/零+/g, '零').replace(/零$/, '') || '零';
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async templates(): Promise<unknown[]> {
    return this.prisma.contractTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  }

  async list(user: AuthUser, query: ListContractsQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = await this.scopeWhere(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    if (query.status) where.signStatus = query.status;
    if (query.keyword) {
      where.OR = [
        { code: { contains: query.keyword } },
        { listing: { is: { title: { contains: query.keyword } } } },
        { buyerCustomer: { is: { name: { contains: query.keyword } } } },
        { sellerCustomer: { is: { name: { contains: query.keyword } } } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: CONTRACT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return { items: rows.map((row) => this.toListDto(row)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string): Promise<unknown> {
    const row = await this.findScoped(user, id);
    return this.toDetailDto(row);
  }

  /** 交易全流程：贷款/评估/资金监管/过户材料/税费/预约/登记/佣金（E2） */
  async fullFlow(user: AuthUser, id: string): Promise<unknown> {
    const row = await this.findScoped(user, id);
    const [loan, escrow, materials, taxes, appointments, registration, commission] = await Promise.all([
      this.prisma.loanApplication.findFirst({ where: { contractId: id }, include: { appraisals: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.escrowAccount.findUnique({ where: { contractId: id }, include: { transactions: { orderBy: { createdAt: 'asc' } } } }),
      this.prisma.materialChecklist.findMany({ where: { contractId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.taxRecord.findMany({ where: { contractId: id } }),
      this.prisma.transferAppointment.findMany({ where: { contractId: id }, orderBy: { appointmentAt: 'asc' } }),
      this.prisma.registrationApplication.findUnique({ where: { contractId: id } }),
      this.prisma.commissionSettlement.findUnique({ where: { contractId: id }, include: { allocations: true } }),
    ]);
    return {
      contract: this.toDetailDto(row),
      loan,
      escrow,
      materials,
      taxes,
      appointments,
      registration,
      commission,
    };
  }

  async create(user: AuthUser, dto: CreateContractDto): Promise<unknown> {
    const listing = await this.prisma.houseListing.findFirst({
      where: { id: dto.listingId, isDeleted: false },
      include: { community: true, agent: { include: { user: true } }, agency: true },
    });
    if (!listing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在' });
    if (listing.status !== 'on_sale') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅「在售」房源可发起签约' });
    }

    const [buyer, seller, template] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: dto.buyerCustomerId, type: 'buyer', isDeleted: false } }),
      this.prisma.customer.findFirst({ where: { id: dto.sellerCustomerId, type: 'seller', isDeleted: false } }),
      this.prisma.contractTemplate.findFirst({ where: { id: dto.templateId, isActive: true } }),
    ]);
    if (!buyer) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '买方客户不存在或类型不符' });
    if (!seller) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '卖方客户不存在或类型不符' });
    if (!template) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '合同模板不存在或已停用' });

    const amount = dto.amount ?? listing.totalPrice;
    if (amount !== listing.totalPrice) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '合同金额必须等于房源挂牌总价（演示规则）' });
    }
    const commissionRate = dto.commissionRate ?? 0.015;
    const commissionAmount = Math.round(amount * commissionRate);
    const depositAmount = dto.depositAmount ?? Math.round(amount * 0.05);

    const contentSnapshot = this.renderTemplate(template.content, {
      sellerName: seller.name,
      buyerName: buyer.name,
      agencyName: listing.agency.name,
      communityName: listing.community.name,
      address: listing.address,
      area: listing.area,
      amount,
      amountCn: amountToCn(amount),
      depositAmount,
      paymentTerms: '一次性付款（演示）',
      transferDeadline: dayjs().add(30, 'day').format('YYYY年MM月DD日'),
      commissionRate: `${(commissionRate * 100).toFixed(1)}%`,
      commissionAmount,
      commissionPayer: '买受人',
    });

    const code = await this.nextCode();
    const contract = await this.prisma.contract.create({
      data: {
        code,
        listingId: listing.id,
        buyerCustomerId: buyer.id,
        sellerCustomerId: seller.id,
        templateId: template.id,
        agentId: listing.agentId,
        agencyId: listing.agencyId,
        amount,
        commissionRate,
        commissionAmount,
        depositAmount,
        signStatus: 'draft',
        contentSnapshot,
        progress: {
          create: [
            { nodeType: 'sign', sortOrder: 1, status: 'todo' },
            { nodeType: 'loan', sortOrder: 2, status: 'todo' },
            { nodeType: 'tax', sortOrder: 3, status: 'todo' },
            { nodeType: 'transfer', sortOrder: 4, status: 'todo' },
            { nodeType: 'handover', sortOrder: 5, status: 'todo' },
          ],
        },
      },
      include: CONTRACT_INCLUDE,
    });

    await this.audit.record('create_contract', 'contract', contract.id, { code: contract.code, amount });
    for (const target of [buyer.userId, seller.userId, listing.agent.userId]) {
      if (target) {
        await this.notify(target, 'contract', '合同已发起', `合同 ${code} 已生成，金额 ${amount.toLocaleString()} 元，请及时确认条款并完成签署。`, 'contract', contract.id);
      }
    }
    return this.toDetailDto(contract);
  }

  async sign(user: AuthUser, id: string): Promise<unknown> {
    const row = await this.findScoped(user, id);
    if (!['draft', 'pending'].includes(row.signStatus)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '当前合同状态不可签署' });
    }
    if (user.role === 'buyer' || user.role === 'seller') {
      const isBuyer = row.buyerCustomer.userId === user.id;
      const isSeller = row.sellerCustomer.userId === user.id;
      if (!isBuyer && !isSeller) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '只能签署与本人相关的合同' });
      }
    }

    const esignNo = `ESIGN-${dayjs().format('YYYY')}-${String(await this.nextSignSeq()).padStart(6, '0')}`;
    const signedAt = new Date();
    const [contract] = await this.prisma.$transaction([
      this.prisma.contract.update({
        where: { id },
        data: { signStatus: 'signed', signMethod: 'esign_mock', esignNo, signedAt },
        include: CONTRACT_INCLUDE,
      }),
      this.prisma.houseListing.update({
        where: { id: row.listingId },
        data: { status: 'signed', soldAt: signedAt },
      }),
    ]);

    await this.audit.record('sign_contract', 'contract', id, { code: row.code, esignNo });
    const participants = [row.buyerCustomer.userId, row.sellerCustomer.userId, row.agent.userId, row.agent.userId];
    for (const target of new Set(participants)) {
      if (target) {
        await this.notify(target, 'contract', '合同已签署', `合同 ${row.code} 已完成电子签署（Mock 电子签），房源状态更新为已签约。`, 'contract', id);
      }
    }
    return this.toDetailDto(contract);
  }

  async void(user: AuthUser, id: string): Promise<unknown> {
    const row = await this.findScoped(user, id);
    if (!['draft', 'pending'].includes(row.signStatus)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅草稿/待签署合同可作废' });
    }
    const contract = await this.prisma.contract.update({
      where: { id },
      data: { signStatus: 'voided', voidedAt: new Date() },
      include: CONTRACT_INCLUDE,
    });
    await this.audit.record('void_contract', 'contract', id, { code: row.code });
    return this.toDetailDto(contract);
  }

  async download(user: AuthUser, id: string): Promise<{ buffer: Uint8Array; fileName: string }> {
    const row = await this.findScoped(user, id);
    const buffer = await buildContractPdf({
      code: row.code,
      title: row.listing.title,
      signedAt: row.signedAt,
      esignNo: row.esignNo,
      content: row.contentSnapshot || row.template.content,
      listingTitle: `${row.listing.community.name} ${row.listing.title}`,
      amount: row.amount,
      commissionAmount: row.commissionAmount,
      buyerName: row.buyerCustomer.name,
      sellerName: row.sellerCustomer.name,
      agentName: row.agent.user.name,
      agencyName: row.agency.name,
    });
    await this.audit.record('download_contract', 'contract', id, { code: row.code });
    return { buffer, fileName: `${row.code}-房屋买卖合同.pdf` };
  }

  async progress(user: AuthUser, contractId: string): Promise<unknown[]> {
    const row = await this.findScoped(user, contractId);
    return row.progress.map((node) => this.toProgressDto(node));
  }

  async updateProgress(user: AuthUser, progressId: string, dto: UpdateProgressDto): Promise<unknown> {
    const node = await this.prisma.transactionProgress.findUnique({
      where: { id: progressId },
      include: { contract: { include: CONTRACT_INCLUDE } },
    });
    if (!node) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '进度节点不存在' });
    await this.findScoped(user, node.contractId);

    const nextStatus = dto.status ?? node.status;
    if (nextStatus === node.status && !dto.plannedDate && !dto.remark) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '没有需要更新的内容' });
    }

    if (['doing', 'done'].includes(nextStatus)) {
      const previous = node.contract.progress.filter((item) => item.sortOrder < node.sortOrder);
      const blocked = previous.find((item) => item.status !== 'done');
      if (blocked) {
        throw new BadRequestException({
          code: ERROR_CODES.BUSINESS_RULE,
          message: `请先完成前序节点（${blocked.nodeType}）`,
        });
      }
    }

    const updated = await this.prisma.transactionProgress.update({
      where: { id: progressId },
      data: {
        status: nextStatus,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : node.plannedDate,
        completedAt:
          nextStatus === 'done'
            ? dto.completedAt
              ? new Date(dto.completedAt)
              : new Date()
            : node.completedAt,
        operatorId: user.id,
        remark: dto.remark ?? node.remark,
      },
    });

    await this.audit.record('update_progress', 'transaction_progress', progressId, { status: nextStatus });
    if (nextStatus === 'done') {
      for (const target of [node.contract.buyerCustomer.userId, node.contract.sellerCustomer.userId]) {
        if (target) {
          await this.notify(target, 'progress', '交易进度更新', `合同 ${node.contract.code} 已完成「${node.nodeType}」节点，请查看最新进展。`, 'contract', node.contractId);
        }
      }
    }
    return this.toProgressDto(updated);
  }

  async notifyProgress(user: AuthUser, progressId: string): Promise<{ sent: number }> {
    const node = await this.prisma.transactionProgress.findUnique({
      where: { id: progressId },
      include: { contract: { include: CONTRACT_INCLUDE } },
    });
    if (!node) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '进度节点不存在' });
    await this.findScoped(user, node.contractId);
    let sent = 0;
    for (const target of [node.contract.buyerCustomer.userId, node.contract.sellerCustomer.userId]) {
      if (target) {
        await this.notify(target, 'progress', '交易进度提醒', `合同 ${node.contract.code} 的「${node.nodeType}」节点当前状态：${node.status}。`, 'contract', node.contractId);
        sent += 1;
      }
    }
    return { sent };
  }

  // ---------- 内部 ----------

  private async scopeWhere(user: AuthUser): Promise<Prisma.ContractWhereInput> {
    if (user.role === 'buyer' || user.role === 'seller') {
      return {
        isDeleted: false,
        OR: [{ buyerCustomer: { is: { userId: user.id } } }, { sellerCustomer: { is: { userId: user.id } } }],
      };
    }
    const scope = await resolveScope(this.prisma, user);
    if (scope.isAdmin) return { isDeleted: false };
    if (!scope.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店' });
    if (user.role === 'agent' && scope.agentId) return { isDeleted: false, agentId: scope.agentId };
    if (user.role === 'finance') {
      // 机构财务：总部账号可查看全部门店合同；门店财务仅本店
      const agency = await this.prisma.agency.findUnique({ where: { id: scope.agencyId }, select: { id: true, parentId: true } });
      if (agency && !agency.parentId) {
        const children = await this.prisma.agency.findMany({ where: { parentId: agency.id }, select: { id: true } });
        return { isDeleted: false, agencyId: { in: [agency.id, ...children.map((item) => item.id)] } };
      }
    }
    return { isDeleted: false, agencyId: scope.agencyId };
  }

  private async findScoped(user: AuthUser, id: string): Promise<ContractRow> {
    const where = await this.scopeWhere(user);
    const row = await this.prisma.contract.findFirst({ where: { AND: [where, { id }] }, include: CONTRACT_INCLUDE });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    return row;
  }

  private async nextCode(): Promise<string> {
    const year = dayjs().format('YYYY');
    const last = await this.prisma.contract.findFirst({ where: { code: { startsWith: `HT${year}` } }, orderBy: { code: 'desc' }, select: { code: true } });
    const seq = last ? Number(last.code.slice(6)) + 1 : 1;
    return `HT${year}${String(seq).padStart(6, '0')}`;
  }

  private async nextSignSeq(): Promise<number> {
    return (await this.prisma.contract.count({ where: { signMethod: 'esign_mock' } })) + 1;
  }

  private renderTemplate(content: string, values: Record<string, string | number>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(values[key] ?? ''));
  }

  private async notify(userId: string, type: string, title: string, content: string, bizType: string, bizId: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, title, content, bizType, bizId } });
  }

  private toListDto(row: ContractRow): Record<string, unknown> {
    const doneCount = row.progress.filter((item) => item.status === 'done').length;
    return {
      id: row.id,
      code: row.code,
      signStatus: row.signStatus,
      amount: row.amount,
      commissionAmount: row.commissionAmount,
      commissionRate: row.commissionRate,
      signedAt: row.signedAt,
      esignNo: row.esignNo,
      listing: {
        id: row.listing.id,
        title: row.listing.title,
        code: row.listing.code,
        community: { name: row.listing.community.name, district: row.listing.community.district },
        totalPrice: row.listing.totalPrice,
        area: row.listing.area,
      },
      buyer: { id: row.buyerCustomer.id, name: row.buyerCustomer.name, phone: row.buyerCustomer.phone },
      seller: { id: row.sellerCustomer.id, name: row.sellerCustomer.name, phone: row.sellerCustomer.phone },
      agent: { id: row.agent.id, name: row.agent.user.name },
      progressDone: doneCount,
      progressTotal: row.progress.length,
      createdAt: row.createdAt,
    };
  }

  private toDetailDto(row: ContractRow): Record<string, unknown> {
    return {
      ...this.toListDto(row),
      agency: { id: row.agency.id, name: row.agency.name },
      template: { id: row.template.id, name: row.template.name, version: row.template.version },
      contentSnapshot: row.contentSnapshot,
      depositAmount: row.depositAmount,
      voidedAt: row.voidedAt,
      signMethod: row.signMethod,
      progress: row.progress.map((node) => this.toProgressDto(node)),
      payments: row.payments.map((payment) => ({
        id: payment.id,
        type: payment.type,
        amount: payment.amount,
        status: payment.status,
        tradeNo: payment.tradeNo,
        paidAt: payment.paidAt,
      })),
    };
  }

  private toProgressDto(node: {
    id: string;
    nodeType: string;
    status: string;
    sortOrder: number;
    plannedDate: Date | null;
    completedAt: Date | null;
    remark: string | null;
  }): Record<string, unknown> {
    return {
      id: node.id,
      nodeType: node.nodeType,
      status: node.status,
      sortOrder: node.sortOrder,
      plannedDate: node.plannedDate,
      completedAt: node.completedAt,
      remark: node.remark,
    };
  }
}
