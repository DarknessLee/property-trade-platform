import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERROR_CODES } from '../../common/constants';
import { AuditService } from '../audit/audit.service';
import type { CommunityQueryDto, CreateCommunityDto } from './dto';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: CommunityQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = {
      isDeleted: false,
      ...(query.district ? { district: query.district } : {}),
      ...(query.keyword
        ? { OR: [{ name: { contains: query.keyword } }, { address: { contains: query.keyword } }] }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.community.findMany({
        where,
        orderBy: [{ district: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              listings: { where: { isDeleted: false } },
            },
          },
        },
      }),
      this.prisma.community.count({ where }),
    ]);

    const onSaleCounts = await this.prisma.houseListing.groupBy({
      by: ['communityId'],
      where: { status: 'on_sale', isDeleted: false, communityId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const onSaleMap = new Map(onSaleCounts.map((item) => [item.communityId, item._count._all]));

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        district: row.district,
        businessArea: row.businessArea,
        address: row.address,
        buildYear: row.buildYear,
        totalBuildings: row.totalBuildings,
        plotRatio: row.plotRatio,
        greenRate: row.greenRate,
        propertyFee: row.propertyFee,
        lng: row.lng,
        lat: row.lat,
        listingCount: row._count.listings,
        onSaleCount: onSaleMap.get(row.id) ?? 0,
      })),
      total,
      page,
      pageSize,
    };
  }

  async options(): Promise<Array<{ id: string; name: string; district: string; businessArea: string }>> {
    const rows = await this.prisma.community.findMany({
      where: { isDeleted: false },
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, district: true, businessArea: true },
    });
    return rows;
  }

  async create(dto: CreateCommunityDto): Promise<unknown> {
    const exists = await this.prisma.community.findFirst({
      where: { name: dto.name, district: dto.district, isDeleted: false },
    });
    if (exists) {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: '该区域已存在同名小区' });
    }
    const community = await this.prisma.community.create({
      data: {
        name: dto.name,
        district: dto.district,
        businessArea: dto.businessArea,
        address: dto.address,
        buildYear: dto.buildYear,
        totalBuildings: dto.totalBuildings ?? 10,
        plotRatio: dto.plotRatio,
        greenRate: dto.greenRate ?? 0.35,
        propertyFee: dto.propertyFee,
        lng: dto.lng,
        lat: dto.lat,
      },
    });
    await this.audit.record('create_community', 'community', community.id, { name: community.name });
    return community;
  }
}
