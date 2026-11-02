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

  /** 区域行情：各区在售量、均价、成交量与成交金额 */
  async market(user: AuthUser): Promise<unknown[]> {
    const scope = await this.resolveStatsScope(user);
    const listingWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const contractWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId, signStatus: 'signed' }
      : scope.all
        ? { isDeleted: false, signStatus: 'signed' }
        : { isDeleted: false, signStatus: 'signed', agencyId: { in: scope.agencyIds } };
    const [listings, contracts] = await Promise.all([
      this.prisma.houseListing.findMany({
        where: { ...listingWhere, status: 'on_sale' },
        select: { unitPrice: true, community: { select: { district: true, name: true } } },
      }),
      this.prisma.contract.findMany({
        where: contractWhere,
        select: { amount: true, listing: { select: { community: { select: { district: true, name: true } } } } },
      }),
    ]);
    const districts = Array.from(new Set([...listings.map((item) => item.community.district), ...contracts.map((item) => item.listing.community.district)]));
    return districts.sort().map((district) => {
      const districtListings = listings.filter((item) => item.community.district === district);
      const districtContracts = contracts.filter((item) => item.listing.community.district === district);
      const dealAmount = districtContracts.reduce((sum, item) => sum + item.amount, 0);
      const communityNames = Array.from(new Set(districtListings.map((item) => item.community.name)));
      const communities = communityNames.map((name) => {
        const rows = districtListings.filter((item) => item.community.name === name);
        const deals = districtContracts.filter((item) => item.listing.community.name === name);
        const communityDealAmount = deals.reduce((sum, item) => sum + item.amount, 0);
        return {
          name,
          onSaleCount: rows.length,
          avgUnitPrice: rows.length ? Math.round(rows.reduce((sum, item) => sum + item.unitPrice, 0) / rows.length) : 0,
          signedCount: deals.length,
          dealAmount: communityDealAmount,
        };
      });
      return {
        district,
        onSaleCount: districtListings.length,
        avgUnitPrice: districtListings.length ? Math.round(districtListings.reduce((sum, item) => sum + item.unitPrice, 0) / districtListings.length) : 0,
        signedCount: districtContracts.length,
        dealAmount,
        avgDealAmount: districtContracts.length ? Math.round(dealAmount / districtContracts.length) : 0,
        communities,
      };
    });
  }

  /** 挂牌价走势：按月统计各房源最新挂牌单价的均值（可下钻到行政区） */
  async priceTrend(user: AuthUser, district?: string, months = 6): Promise<Array<{ month: string; avgUnitPrice: number; listingCount: number }>> {
    const scope = await this.resolveStatsScope(user);
    const baseWhere = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const listingWhere = { ...baseWhere, ...(district ? { community: { is: { district } } } : {}) };
    const histories = await this.prisma.priceHistory.findMany({
      where: { listing: { is: listingWhere } },
      select: { listingId: true, unitPrice: true, changedAt: true },
      orderBy: { changedAt: 'asc' },
    });
    const now = dayjs();
    return Array.from({ length: months }).map((_, index) => {
      const monthStart = now.subtract(months - 1 - index, 'month').startOf('month');
      const monthEnd = now.subtract(months - 1 - index, 'month').endOf('month');
      const latest = new Map<string, number>();
      for (const row of histories) {
        if (row.changedAt <= monthEnd.toDate()) latest.set(row.listingId, row.unitPrice);
      }
      const values = Array.from(latest.values());
      return {
        month: monthStart.format('YYYY-MM'),
        avgUnitPrice: values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : 0,
        listingCount: values.length,
      };
    });
  }

  /** 客群画像：预算段、等级、类型、热门标签 */
  async customers(user: AuthUser): Promise<unknown> {
    const scope = await this.resolveStatsScope(user);
    const where = scope.agentId
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const rows = await this.prisma.customer.findMany({ where, select: { type: true, level: true, budgetMax: true, tagsJson: true } });
    const buyers = rows.filter((item) => item.type === 'buyer');
    const segments = [
      { label: '200 万以下', min: 0, max: 2_000_000 },
      { label: '200-300 万', min: 2_000_000, max: 3_000_000 },
      { label: '300-500 万', min: 3_000_000, max: 5_000_000 },
      { label: '500 万以上', min: 5_000_000, max: Number.MAX_SAFE_INTEGER },
    ];
    const tagCount = new Map<string, number>();
    for (const row of rows) {
      try {
        for (const tag of JSON.parse(row.tagsJson) as string[]) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      } catch {
        // ignore
      }
    }
    return {
      total: rows.length,
      types: {
        buyer: rows.filter((item) => item.type === 'buyer').length,
        seller: rows.filter((item) => item.type === 'seller').length,
      },
      levels: ['A', 'B', 'C'].map((level) => ({ level, count: rows.filter((item) => item.level === level).length })),
      budgetSegments: segments.map((segment) => ({
        label: segment.label,
        count: buyers.filter((item) => (item.budgetMax ?? 0) >= segment.min && (item.budgetMax ?? 0) < segment.max).length,
      })),
      topTags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count })),
    };
  }

  /** 转化漏斗：浏览 → 带看 → 合同发起 → 签约成交 */
  async funnel(user: AuthUser): Promise<{ stages: Array<{ name: string; value: number }> }> {
    const scope = await this.resolveStatsScope(user);
    const listingWhere = scope.agentId
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
      ? { isDeleted: false, agentId: scope.agentId }
      : scope.all
        ? { isDeleted: false }
        : { isDeleted: false, agencyId: { in: scope.agencyIds } };
    const [listings, showingCount, contractCount, signedCount] = await Promise.all([
      this.prisma.houseListing.findMany({ where: listingWhere, select: { viewCount: true } }),
      this.prisma.showing.count({ where: showingWhere }),
      this.prisma.contract.count({ where: contractWhere }),
      this.prisma.contract.count({ where: { ...contractWhere, signStatus: 'signed' } }),
    ]);
    return {
      stages: [
        { name: '房源浏览', value: listings.reduce((sum, item) => sum + item.viewCount, 0) },
        { name: '带看', value: showingCount },
        { name: '合同发起', value: contractCount },
        { name: '签约成交', value: signedCount },
      ],
    };
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

  @Get('market')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  market(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.stats.market(user);
  }

  @Get('customers')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  customers(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.stats.customers(user);
  }

  @Get('funnel')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  funnel(@CurrentUser() user: AuthUser): Promise<{ stages: Array<{ name: string; value: number }> }> {
    return this.stats.funnel(user);
  }

  @Get('price-trend')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  priceTrend(@CurrentUser() user: AuthUser, @Query('district') district?: string, @Query('months') months?: string): Promise<Array<{ month: string; avgUnitPrice: number; listingCount: number }>> {
    const parsed = Math.min(12, Math.max(3, Number(months) || 6));
    return this.stats.priceTrend(user, district, parsed);
  }
}

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
