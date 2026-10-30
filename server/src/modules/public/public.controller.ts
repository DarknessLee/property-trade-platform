import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';

interface ListingImage {
  name: string;
  url: string;
}

interface CommunityLite {
  id: string;
  name: string;
  district: string;
  businessArea: string;
  address: string;
  buildYear: number;
  plotRatio: number;
  greenRate: number;
  propertyFee: number;
  lng: number;
  lat: number;
}

interface ListingRow {
  id: string;
  code: string;
  title: string;
  area: number;
  totalPrice: number;
  unitPrice: number;
  rooms: number;
  halls: number;
  bathrooms: number;
  orientation: string;
  floor: number;
  totalFloors: number;
  buildYear: number;
  propertyType: string;
  decoration: string;
  status: string;
  verifyStatus: string;
  description: string;
  imagesJson: string;
  address: string;
  listedAt: Date | null;
  viewCount: number;
  community: CommunityLite;
  agent: { id: string; user: { name: string }; agency: { id: string; name: string; phone: string } };
}

function parseImages(json: string): ListingImage[] {
  try {
    return JSON.parse(json) as ListingImage[];
  } catch {
    return [];
  }
}

@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  /** C 端首页统计（公开） */
  @Public()
  @Get('home')
  async home(): Promise<{ onSaleListings: number; communities: number; signedContracts: number; agencies: number; agents: number }> {
    const [onSaleListings, communities, signedContracts, agencies, agents] = await Promise.all([
      this.prisma.houseListing.count({ where: { status: 'on_sale', isDeleted: false } }),
      this.prisma.community.count({ where: { isDeleted: false } }),
      this.prisma.contract.count({ where: { signStatus: 'signed', isDeleted: false } }),
      this.prisma.agency.count({ where: { isDeleted: false } }),
      this.prisma.agent.count({ where: { isDeleted: false } }),
    ]);
    return { onSaleListings, communities, signedContracts, agencies, agents };
  }

  /** 房源列表（公开，仅展示在售） */
  @Public()
  @Get('listings')
  async listings(
    @Query('district') district?: string,
    @Query('businessArea') businessArea?: string,
    @Query('keyword') keyword?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('rooms') rooms?: string,
    @Query('minArea') minArea?: string,
    @Query('maxArea') maxArea?: string,
    @Query('orientation') orientation?: string,
    @Query('decoration') decoration?: string,
    @Query('buildYearMin') buildYearMin?: string,
    @Query('buildYearMax') buildYearMax?: string,
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
  ): Promise<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(60, Math.max(1, Number(pageSize) || 12));

    const where: Record<string, unknown> = { status: 'on_sale', isDeleted: false };
    if (district) where.community = { district };
    if (businessArea) where.community = { ...(where.community as object), businessArea };
    if (orientation) where.orientation = orientation;
    if (decoration) where.decoration = decoration;
    if (rooms) where.rooms = Number(rooms);
    if (minPrice || maxPrice) {
      where.totalPrice = {
        ...(minPrice ? { gte: Number(minPrice) } : {}),
        ...(maxPrice ? { lte: Number(maxPrice) } : {}),
      };
    }
    if (minArea || maxArea) {
      where.area = {
        ...(minArea ? { gte: Number(minArea) } : {}),
        ...(maxArea ? { lte: Number(maxArea) } : {}),
      };
    }
    if (buildYearMin || buildYearMax) {
      where.buildYear = {
        ...(buildYearMin ? { gte: Number(buildYearMin) } : {}),
        ...(buildYearMax ? { lte: Number(buildYearMax) } : {}),
      };
    }
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { community: { is: { name: { contains: keyword } } } },
        { address: { contains: keyword } },
      ];
    }

    const orderBy =
      sort === 'price_asc'
        ? { totalPrice: 'asc' as const }
        : sort === 'price_desc'
          ? { totalPrice: 'desc' as const }
          : { listedAt: 'desc' as const };

    const [rows, total] = await Promise.all([
      this.prisma.houseListing.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * size,
        take: size,
        include: { community: true, agent: { include: { user: true, agency: true } } },
      }),
      this.prisma.houseListing.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toListing(row as unknown as ListingRow)),
      total,
      page: pageNum,
      pageSize: size,
    };
  }

  /** 地图找房：房源点位（公开；声明在 :id 之前避免路由冲突） */
  @Public()
  @Get('listings/map')
  async mapPoints(
    @Query('district') district?: string,
  ): Promise<Array<{ id: string; title: string; totalPrice: number; area: number; rooms: number; lng: number; lat: number; district: string; communityName: string }>> {
    const rows = await this.prisma.houseListing.findMany({
      where: { status: 'on_sale', isDeleted: false, ...(district ? { community: { district } } : {}) },
      select: {
        id: true,
        title: true,
        totalPrice: true,
        area: true,
        rooms: true,
        lng: true,
        lat: true,
        community: { select: { name: true, district: true } },
      },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      totalPrice: row.totalPrice,
      area: row.area,
      rooms: row.rooms,
      lng: row.lng,
      lat: row.lat,
      district: row.community.district,
      communityName: row.community.name,
    }));
  }

  /** 房源详情（公开，含小区/区域价格参考） */
  @Public()
  @Get('listings/:id')
  async listingDetail(@Param('id') id: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.houseListing.findFirst({
      where: { id, isDeleted: false },
      include: { community: true, agent: { include: { user: true, agency: true } } },
    });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在或已下架' });
    await this.prisma.houseListing.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    const [communityRows, districtRows] = await Promise.all([
      this.prisma.houseListing.findMany({
        where: { communityId: row.communityId, status: 'on_sale', isDeleted: false },
        select: { id: true, title: true, area: true, totalPrice: true, unitPrice: true },
        orderBy: { unitPrice: 'asc' },
        take: 8,
      }),
      this.prisma.houseListing.findMany({
        where: { status: 'on_sale', isDeleted: false, community: { district: row.community.district } },
        select: { unitPrice: true },
      }),
    ]);
    const priceHistory = await this.prisma.priceHistory.findMany({
      where: { listingId: row.id },
      select: { price: true, unitPrice: true, changedAt: true, source: true, remark: true },
      orderBy: { changedAt: 'asc' },
    });
    const communityAvgUnitPrice = communityRows.length
      ? Math.round(communityRows.reduce((sum, item) => sum + item.unitPrice, 0) / communityRows.length)
      : row.unitPrice;
    const districtAvgUnitPrice = districtRows.length
      ? Math.round(districtRows.reduce((sum, item) => sum + item.unitPrice, 0) / districtRows.length)
      : row.unitPrice;

    return {
      ...this.toListing(row as unknown as ListingRow),
      priceHistory,
      priceContext: {
        communityAvgUnitPrice,
        districtAvgUnitPrice,
        communityOnSaleCount: communityRows.length,
        sameCommunity: communityRows,
      },
    };
  }

  /** 小区列表（公开） */
  @Public()
  @Get('communities')
  async communities(): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.community.findMany({
      where: { isDeleted: false },
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { listings: { where: { status: 'on_sale', isDeleted: false } } } } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      district: row.district,
      businessArea: row.businessArea,
      address: row.address,
      buildYear: row.buildYear,
      plotRatio: row.plotRatio,
      greenRate: row.greenRate,
      propertyFee: row.propertyFee,
      lng: row.lng,
      lat: row.lat,
      onSaleCount: row._count.listings,
    }));
  }

  private toListing(row: ListingRow): Record<string, unknown> {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      community: {
        id: row.community.id,
        name: row.community.name,
        district: row.community.district,
        businessArea: row.community.businessArea,
        address: row.community.address,
        buildYear: row.community.buildYear,
        plotRatio: row.community.plotRatio,
        greenRate: row.community.greenRate,
        propertyFee: row.community.propertyFee,
        lng: row.community.lng,
        lat: row.community.lat,
      },
      area: row.area,
      totalPrice: row.totalPrice,
      unitPrice: row.unitPrice,
      rooms: row.rooms,
      halls: row.halls,
      bathrooms: row.bathrooms,
      orientation: row.orientation,
      floor: row.floor,
      totalFloors: row.totalFloors,
      buildYear: row.buildYear,
      propertyType: row.propertyType,
      decoration: row.decoration,
      status: row.status,
      verifyStatus: row.verifyStatus,
      description: row.description,
      images: parseImages(row.imagesJson),
      address: row.address,
      listedAt: row.listedAt,
      viewCount: row.viewCount,
      agent: {
        id: row.agent.id,
        user: { name: row.agent.user.name },
        agency: { id: row.agent.agency.id, name: row.agent.agency.name, phone: row.agent.agency.phone },
      },
    };
  }
}
