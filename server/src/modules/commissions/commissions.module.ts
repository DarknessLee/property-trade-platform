import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Post, Put, Query } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { contractScopeWhere } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import dayjs from 'dayjs';

export class UpdateCommissionRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  agentRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  coAgentRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  storeRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  platformRate!: number;
}

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
    const rule = await this.getActiveRule();
    const allocations = [
      { role: 'listing_agent', name: contract.agent.user.name, rate: rule.agentRate },
      { role: 'co_agent', name: `${contract.agent.user.name}协作`, rate: rule.coAgentRate },
      { role: 'store', name: contract.agency.name, rate: rule.storeRate },
      { role: 'finance', name: '财务专员·邱丽', rate: rule.platformRate },
    ];
    const amounts = allocations.map((item) => Math.round(totalCommission * item.rate));
    amounts[amounts.length - 1] = totalCommission - amounts.slice(0, -1).reduce((sum, item) => sum + item, 0);

    const settlement = await this.prisma.commissionSettlement.create({
      data: {
        code: `CM${dayjs().format('YYYY')}${String((await this.prisma.commissionSettlement.count()) + 1).padStart(6, '0')}`,
        contractId,
        ruleName: rule.name,
        baseAmount: contract.amount,
        totalCommission,
        status: 'pending',
        allocations: { create: allocations.map((item, index) => ({ ...item, amount: amounts[index] })) },
      },
      include: COMMISSION_INCLUDE,
    });
    await this.audit.record('create_commission', 'commission', settlement.id, { code: settlement.code, totalCommission, rule: rule.name });
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

  async rules() {
    const rule = await this.getActiveRule();
    return {
      name: rule.name,
      description: '佣金 = 合同金额 × 佣金率（1%–2.5%）；按角色分成，合计 100%',
      rates: { agentRate: rule.agentRate, coAgentRate: rule.coAgentRate, storeRate: rule.storeRate, platformRate: rule.platformRate },
      items: [
        { role: 'listing_agent', label: '房源维护经纪人', rate: rule.agentRate },
        { role: 'co_agent', label: '协作经纪人', rate: rule.coAgentRate },
        { role: 'store', label: '门店留存', rate: rule.storeRate },
        { role: 'finance', label: '平台/财务', rate: rule.platformRate },
      ],
    };
  }

  async updateRules(name: string | undefined, rates: { agentRate: number; coAgentRate: number; storeRate: number; platformRate: number }) {
    const sum = rates.agentRate + rates.coAgentRate + rates.storeRate + rates.platformRate;
    if (Math.abs(sum - 1) > 0.001) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '四个角色分成比例合计必须为 100%' });
    }
    const active = await this.prisma.commissionRule.findFirst({ where: { active: true } });
    const updated = active
      ? await this.prisma.commissionRule.update({ where: { id: active.id }, data: { ...rates, ...(name ? { name } : {}) } })
      : await this.prisma.commissionRule.create({ data: { name: name ?? '标准佣金分成规则 V1.0', active: true, ...rates } });
    await this.audit.record('update_commission_rule', 'commission_rule', updated.id, { ...rates });
    return this.rules();
  }

  private async getActiveRule() {
    const rule = await this.prisma.commissionRule.findFirst({ where: { active: true } });
    if (rule) return rule;
    return this.prisma.commissionRule.create({
      data: { name: '标准佣金分成规则 V1.0', active: true, agentRate: 0.6, coAgentRate: 0.15, storeRate: 0.2, platformRate: 0.05 },
    });
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

  @Put('rules')
  @Roles('admin')
  updateRules(@Body() dto: UpdateCommissionRuleDto) {
    return this.commissions.updateRules(dto.name, {
      agentRate: dto.agentRate,
      coAgentRate: dto.coAgentRate,
      storeRate: dto.storeRate,
      platformRate: dto.platformRate,
    });
  }
}

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService],
})
export class CommissionsModule {}
