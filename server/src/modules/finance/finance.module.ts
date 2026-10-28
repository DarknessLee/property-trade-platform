import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { resolveScope } from '../../common/scope';
import { AuditService } from '../audit/audit.service';

const PAYMENT_INCLUDE = {
  contract: {
    include: {
      listing: { select: { id: true, code: true, title: true } },
      buyerCustomer: { select: { name: true } },
      sellerCustomer: { select: { name: true, userId: true } },
      agent: { include: { user: { select: { id: true, name: true } } } },
    },
  },
} as const;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async agencyScope(user: AuthUser): Promise<{ all: boolean; agencyIds: string[] }> {
    if (user.role === 'admin') return { all: true, agencyIds: [] };
    const scope = await resolveScope(this.prisma, user);
    if (!scope.agencyId) return { all: false, agencyIds: ['__none__'] };
    const agency = await this.prisma.agency.findUnique({ where: { id: scope.agencyId }, select: { id: true, parentId: true } });
    if (agency && !agency.parentId) {
      const children = await this.prisma.agency.findMany({ where: { parentId: agency.id }, select: { id: true } });
      return { all: false, agencyIds: [agency.id, ...children.map((item) => item.id)] };
    }
    return { all: false, agencyIds: [scope.agencyId] };
  }

  async list(user: AuthUser, query: { status?: string; type?: string; page?: number; pageSize?: number }) {
    const scope = await this.agencyScope(user);
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 10);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(scope.all ? {} : { contract: { is: { agencyId: { in: scope.agencyIds } } } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        status: row.status,
        tradeNo: row.tradeNo,
        paidAt: row.paidAt,
        remark: row.remark,
        createdAt: row.createdAt,
        contract: {
          id: row.contract.id,
          code: row.contract.code,
          amount: row.contract.amount,
          commissionAmount: row.contract.commissionAmount,
          signStatus: row.contract.signStatus,
          listing: row.contract.listing,
          buyer: row.contract.buyerCustomer.name,
          seller: row.contract.sellerCustomer.name,
          agent: row.contract.agent.user.name,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  async overview(user: AuthUser) {
    const scope = await this.agencyScope(user);
    const where = scope.all ? {} : { contract: { is: { agencyId: { in: scope.agencyIds } } } };
    const payments = await this.prisma.paymentRecord.findMany({ where, select: { type: true, status: true, amount: true } });
    const sum = (status: string, type?: string): number =>
      payments.filter((item) => item.status === status && (!type || item.type === type)).reduce((total, item) => total + item.amount, 0);
    return {
      paidAmount: sum('paid'),
      unpaidAmount: sum('unpaid'),
      commissionPaid: sum('paid', 'commission'),
      commissionUnpaid: sum('unpaid', 'commission'),
      recordCount: payments.length,
    };
  }

  async settle(user: AuthUser, id: string): Promise<unknown> {
    const payment = await this.prisma.paymentRecord.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
    if (!payment) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '资金记录不存在' });
    if (payment.status !== 'unpaid') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '该记录不是待支付状态' });
    }
    const scope = await this.agencyScope(user);
    if (!scope.all && !scope.agencyIds.includes(payment.contract.agencyId)) {
      throw new BadRequestException({ code: ERROR_CODES.FORBIDDEN, message: '无权操作其他门店的资金记录' });
    }
    const updated = await this.prisma.paymentRecord.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date(), remark: '财务核对确认（演示）' },
    });
    await this.audit.record('settle_payment', 'payment', id, { amount: payment.amount, type: payment.type });

    const sellerUserId = payment.contract.sellerCustomer.userId;
    if (sellerUserId) {
      await this.prisma.notification.create({
        data: {
          userId: sellerUserId,
          type: 'progress',
          title: '交易资金已到账',
          content: `合同 ${payment.contract.code} 的${payment.type === 'commission' ? '佣金' : '款项'} ${payment.amount.toLocaleString()} 元已由财务核对入账。`,
          bizType: 'contract',
          bizId: payment.contract.id,
        },
      });
    }
    return { id: updated.id, status: updated.status, paidAt: updated.paidAt };
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @Roles('finance', 'admin')
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<unknown> {
    return this.finance.list(user, { status, type, page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Post(':id/settle')
  @Roles('finance', 'admin')
  settle(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.finance.settle(user, id);
  }
}

@Controller('finance')
export class FinanceOverviewController {
  constructor(private readonly finance: FinanceService) {}

  @Get('overview')
  @Roles('finance', 'admin')
  overview(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.finance.overview(user);
  }
}

@Module({
  controllers: [PaymentsController, FinanceOverviewController],
  providers: [FinanceService],
})
export class FinanceModule {}
