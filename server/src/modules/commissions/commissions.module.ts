import { BadRequestException, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { contractScopeWhere } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import dayjs from 'dayjs';

const COMMISSION_INCLUDE = {
  contract: {
    select: {
      id: true,
      code: true,
      amount: true,
      commissionAmount: true,
      signedAt: true,
      agencyId: true,
      listing: { select: { id: true, title: true, community: { select: { name: true, district: true } } } },
      buyerCustomer: { select: { name: true } },
      sellerCustomer: { select: { name: true } },
      agent: { include: { user: { select: { name: true } } } },
      agency: { select: { name: true } },
    },
  },
  allocations: true,
} as const;

@Injectable()
export class CommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: { status?: string; page?: number; pageSize?: number }) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 10);
    const where = { ...(query.status ? { status: query.status } : {}), contract: { is: contractWhere } };
    const [rows, total] = await Promise.all([
      this.prisma.commissionSettlement.findMany({ where, include: COMMISSION_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.commissionSettlement.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const row = await this.prisma.commissionSettlement.findFirst({ where: { id, contract: { is: contractWhere } }, include: COMMISSION_INCLUDE });
    if (!row) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '佣金结算单不存在或无权访问' });
    return this.toDto(row);
  }

  async settle(user: AuthUser, contractId: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({
      where: { AND: [contractWhere, { id: contractId }] },
      include: { agent: { include: { user: true } }, agency: true },
    });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    if (contract.signStatus !== 'signed') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅已签署合同可结算佣金' });
    const existing = await this.prisma.commissionSettlement.findUnique({ where: { contractId } });
    if (existing) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: `该合同已生成佣金结算单（${existing.code}）` });

    const totalCommission = contract.commissionAmount;
    const allocations = [
      { role: 'listing_agent', name: contract.agent.user.name, rate: 0.6 },
      { role: 'co_agent', name: `${contract.agent.user.name}协作`, rate: 0.15 },
      { role: 'store', name: contract.agency.name, rate: 0.2 },
      { role: 'finance', name: '财务专员·邱丽', rate: 0.05 },
    ];
    const amounts = allocations.map((item) => Math.round(totalCommission * item.rate));
    amounts[amounts.length - 1] = totalCommission - amounts.slice(0, -1).reduce((sum, item) => sum + item, 0);

    const settlement = await this.prisma.commissionSettlement.create({
      data: {
        code: `CM${dayjs().format('YYYY')}${String((await this.prisma.commissionSettlement.count()) + 1).padStart(6, '0')}`,
        contractId,
        ruleName: '标准佣金分成规则 V1.0',
        baseAmount: contract.amount,
        totalCommission,
        status: 'pending',
        allocations: { create: allocations.map((item, index) => ({ ...item, amount: amounts[index] })) },
      },
      include: COMMISSION_INCLUDE,
    });
    await this.audit.record('create_commission', 'commission', settlement.id, { code: settlement.code, totalCommission });
    return this.toDto(settlement);
  }

  async confirm(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const settlement = await this.prisma.commissionSettlement.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!settlement) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '佣金结算单不存在或无权访问' });
    if (settlement.status !== 'pending') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅待确认状态可确认' });
    const updated = await this.prisma.commissionSettlement.update({ where: { id }, data: { status: 'confirmed', confirmedAt: new Date() }, include: COMMISSION_INCLUDE });
    await this.audit.record('confirm_commission', 'commission', id, { code: settlement.code });
    return this.toDto(updated);
  }

  async pay(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const settlement = await this.prisma.commissionSettlement.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!settlement) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '佣金结算单不存在或无权访问' });
    if (settlement.status !== 'confirmed') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅已确认状态可支付' });
    const updated = await this.prisma.commissionSettlement.update({ where: { id }, data: { status: 'paid', paidAt: new Date() }, include: COMMISSION_INCLUDE });
    await this.audit.record('pay_commission', 'commission', id, { code: settlement.code });
    return this.toDto(updated);
  }

  rules() {
    return {
      name: '标准佣金分成规则 V1.0',
      description: '佣金 = 合同金额 × 佣金率（1%–2.5%）；按角色分成，合计 100%',
      items: [
        { role: 'listing_agent', label: '房源维护经纪人', rate: 0.6 },
        { role: 'co_agent', label: '协作经纪人', rate: 0.15 },
        { role: 'store', label: '门店留存', rate: 0.2 },
        { role: 'finance', label: '平台/财务', rate: 0.05 },
      ],
    };
  }

  private toDto(row: {
    id: string;
    code: string;
    ruleName: string;
    baseAmount: number;
    totalCommission: number;
    status: string;
    confirmedAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    contract: unknown;
    allocations: unknown[];
  }): Record<string, unknown> {
    return {
      id: row.id,
      code: row.code,
      ruleName: row.ruleName,
      baseAmount: row.baseAmount,
      totalCommission: row.totalCommission,
      status: row.status,
      confirmedAt: row.confirmedAt,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      contract: row.contract,
      allocations: row.allocations,
    };
  }
}

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get('rules')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  rules() {
    return this.commissions.rules();
  }

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.commissions.list(user, { status, page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commissions.detail(user, id);
  }

  @Post('contracts/:contractId/settle')
  @Roles('store_manager', 'admin')
  settle(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string) {
    return this.commissions.settle(user, contractId);
  }

  @Post(':id/confirm')
  @Roles('store_manager', 'admin')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commissions.confirm(user, id);
  }

  @Post(':id/pay')
  @Roles('finance', 'admin')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commissions.pay(user, id);
  }
}

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService],
})
export class CommissionsModule {}
