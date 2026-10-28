import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { resolveScope } from '../../common/scope';

interface StatsScope {
  all: boolean;
  agencyIds: string[];
  agentId: string | null;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveStatsScope(user: AuthUser): Promise<StatsScope> {
    if (user.role === 'admin') return { all: true, agencyIds: [], agentId: null };
    const scope = await resolveScope(this.prisma, user);
    if (user.role === 'agent' && scope.agentId) return { all: false, agencyIds: [], agentId: scope.agentId };
    if (!scope.agencyId) return { all: false, agencyIds: ['__none__'], agentId: null };
    const agency = await this.prisma.agency.findUnique({ where: { id: scope.agencyId }, select: { id: true, parentId: true } });
    if (user.role === 'finance' && agency && !agency.parentId) {
      const children = await this.prisma.agency.findMany({ where: { parentId: agency.id }, select: { id: true } });
      return { all: false, agencyIds: [agency.id, ...children.map((item) => item.id)], agentId: null };
    }
    return { all: false, agencyIds: [scope.agencyId], agentId: null };
  }

  async overview(user: AuthUser): Promise<Record<string, number>> {
    const scope = await this.resolveStatsScope(user);
    const listingWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const customerWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const showingWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agent: { agencyId: { in: scope.agencyIds } } };
    const contractWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId, signStatus: 'signed' }
      : scope.all
        ? { isDeleted: false, signStatus: 'signed' }
        : { isDeleted: false, signStatus: 'signed', agencyId: { in: scope.agencyIds } };

    const [listingCount, onSaleCount, customerCount, showingCount, showingDoneCount, contracts, pendingVerify] = await Promise.all([
      this.prisma.houseListing.count({ where: listingWhere }),
      this.prisma.houseListing.count({ where: { ...listingWhere, status: 'on_sale' } }),
      this.prisma.customer.count({ where: customerWhere }),
      this.prisma.showing.count({ where: showingWhere }),
      this.prisma.showing.count({ where: { ...showingWhere, status: 'done' } }),
      this.prisma.contract.findMany({ where: contractWhere, select: { amount: true, commissionAmount: true } }),
      this.prisma.houseListing.count({ where: { ...listingWhere, verifyStatus: 'pending' } }),
    ]);
    return {
      listingCount,
      onSaleCount,
      customerCount,
      showingCount,
      showingDoneCount,
      signedContractCount: contracts.length,
      dealAmount: contracts.reduce((sum, item) => sum + item.amount, 0),
      commissionAmount: contracts.reduce((sum, item) => sum + item.commissionAmount, 0),
      pendingVerifyCount: pendingVerify,
    };
  }

  async trend(user: AuthUser, months = 6): Promise<Array<{ month: string; contractCount: number; dealAmount: number; commissionAmount: number }>> {
    const scope = await this.resolveStatsScope(user);
    const start = dayjs().subtract(months - 1, 'month').startOf('month');
    const where = {
      isDeleted: false,
      signStatus: 'signed',
      signedAt: { gte: start.toDate() },
      ...(scope.agentId ? { agentId: scope.agentId } : scope.all ? {} : { agencyId: { in: scope.agencyIds } }),
    };
    const contracts = await this.prisma.contract.findMany({ where, select: { signedAt: true, amount: true, commissionAmount: true } });
    const result: Array<{ month: string; contractCount: number; dealAmount: number; commissionAmount: number }> = [];
    for (let index = 0; index < months; index += 1) {
      const month = start.add(index, 'month').format('YYYY-MM');
      const monthContracts = contracts.filter((item) => item.signedAt && dayjs(item.signedAt).format('YYYY-MM') === month);
      result.push({
        month,
        contractCount: monthContracts.length,
        dealAmount: monthContracts.reduce((sum, item) => sum + item.amount, 0),
        commissionAmount: monthContracts.reduce((sum, item) => sum + item.commissionAmount, 0),
      });
    }
    return result;
  }

  async ranking(user: AuthUser): Promise<unknown[]> {
    const scope = await this.resolveStatsScope(user);
    const agentWhere = scope.agentId
      ? { id: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const agents = await this.prisma.agent.findMany({
      where: agentWhere,
      include: { user: { select: { name: true } }, agency: { select: { name: true } } },
    });
    const ranking: Array<{ id: string; name: string; agency: string; signedContractCount: number; dealAmount: number; showingCount: number }> = [];
    for (const agent of agents) {
      const [contracts, showings] = await Promise.all([
        this.prisma.contract.findMany({ where: { agentId: agent.id, signStatus: 'signed', isDeleted: false }, select: { amount: true } }),
        this.prisma.showing.count({ where: { agentId: agent.id, isDeleted: false } }),
      ]);
      ranking.push({
        id: agent.id,
        name: agent.user.name,
        agency: agent.agency.name,
        signedContractCount: contracts.length,
        dealAmount: contracts.reduce((sum, item) => sum + item.amount, 0),
        showingCount: showings,
      });
    }
    return ranking.sort((a, b) => b.dealAmount - a.dealAmount || b.showingCount - a.showingCount);
  }
}

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  overview(@CurrentUser() user: AuthUser): Promise<Record<string, number>> {
    return this.stats.overview(user);
  }

  @Get('trend')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  trend(@CurrentUser() user: AuthUser, @Query('months') months?: string): Promise<Array<{ month: string; contractCount: number; dealAmount: number; commissionAmount: number }>> {
    const parsed = Math.min(12, Math.max(3, Number(months) || 6));
    return this.stats.trend(user, parsed);
  }

  @Get('ranking')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  ranking(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.stats.ranking(user);
  }
}

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
