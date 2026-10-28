import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { AuditService } from '../audit/audit.service';
import type { CreateListingDto, ListListingsQueryDto, UpdateListingDto, VerifyListingDto } from './dto';

const LISTING_INCLUDE = {
  community: true,
  owner: { select: { id: true, name: true, phone: true } },
  agent: { include: { user: { select: { id: true, name: true, phone: true } }, agency: true } },
  agency: true,
} satisfies Prisma.HouseListingInclude;

type ListingRow = Prisma.HouseListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: ListListingsQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = await this.scopeWhere(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    if (query.status) where.status = query.status;
    if (query.verifyStatus) where.verifyStatus = query.verifyStatus;
    if (query.agentId) where.agentId = query.agentId;
    if (query.district) where.community = { district: query.district };
    if (query.keyword) {
      const keyword = query.keyword.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: keyword } },
            { code: { contains: keyword } },
            { community: { is: { name: { contains: keyword } } } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.houseListing.findMany({
        where,
        include: LISTING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.houseListing.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string): Promise<unknown> {
    const where = await this.scopeWhere(user);
    const row = await this.prisma.houseListing.findFirst({ where: { AND: [where, { id }] }, include: LISTING_INCLUDE });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在或无权访问' });
    const attachments = await this.prisma.attachment.findMany({ where: { bizType: 'listing_agreement', bizId: id } });
    return { ...this.toDto(row), attachments };
  }

  async create(user: AuthUser, dto: CreateListingDto): Promise<unknown> {
    const community = await this.prisma.community.findFirst({ where: { id: dto.communityId, isDeleted: false } });
    if (!community) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '小区不存在' });

    const owner = await this.prisma.user.findFirst({ where: { id: dto.ownerId, role: 'seller', isDeleted: false } });
    if (!owner) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '业主必须是已注册的卖方账号' });

    const agent = await this.resolveAgent(user, dto.agentId);
    if (!agent) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '请选择维护经纪人' });

    const totalPrice = dto.totalPrice ?? Math.round((dto.unitPrice * dto.area) / 1000) * 1000;
    if (Math.abs(totalPrice - dto.unitPrice * dto.area) > 2000) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '总价与单价×面积偏差过大，请核对价格' });
    }
    const unitPrice = dto.totalPrice ? Math.round(dto.totalPrice / dto.area) : dto.unitPrice;

    const code = await this.nextCode();
    const listing = await this.prisma.houseListing.create({
      data: {
        code,
        title: dto.title,
        communityId: community.id,
        ownerId: owner.id,
        agentId: agent.id,
        agencyId: agent.agencyId,
        area: dto.area,
        totalPrice,
        unitPrice,
        rooms: dto.rooms,
        halls: dto.halls,
        bathrooms: dto.bathrooms,
        orientation: dto.orientation,
        floor: dto.floor,
        totalFloors: dto.totalFloors,
        buildYear: dto.buildYear,
        propertyType: dto.propertyType,
        decoration: dto.decoration,
        status: 'pending',
        verifyStatus: 'pending',
        description: dto.description ?? '',
        imagesJson: JSON.stringify(dto.images ?? []),
        address: dto.address ?? `${community.address}${dto.floor}层`,
        lng: dto.lng ?? community.lng,
        lat: dto.lat ?? community.lat,
      },
      include: LISTING_INCLUDE,
    });

    await this.audit.record('create_listing', 'listing', listing.id, { code: listing.code, title: listing.title });
    await this.notify(user.id, 'system', '房源已录入', `房源 ${code} 已创建，请补充委托协议并提交验真。`, 'listing', listing.id);
    return this.toDto(listing);
  }

  async update(user: AuthUser, id: string, dto: UpdateListingDto): Promise<unknown> {
    const listing = await this.findManageable(user, id);
    if (listing.status === 'signed') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '已签约房源不可编辑' });
    }

    const data: Prisma.HouseListingUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.decoration !== undefined) data.decoration = dto.decoration;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.images !== undefined) data.imagesJson = JSON.stringify(dto.images);

    const nextArea = dto.area ?? listing.area;
    const nextUnit = dto.unitPrice ?? listing.unitPrice;
    const nextTotal = dto.totalPrice ?? (dto.unitPrice || dto.area ? Math.round((nextUnit * nextArea) / 1000) * 1000 : listing.totalPrice);
    if (Math.abs(nextTotal - nextUnit * nextArea) > 2000) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '总价与单价×面积偏差过大，请核对价格' });
    }
    const priceChanged =
      nextTotal !== listing.totalPrice || nextUnit !== listing.unitPrice || nextArea !== listing.area;
    if (priceChanged && listing.status === 'on_sale') {
      throw new BadRequestException({
        code: ERROR_CODES.BUSINESS_RULE,
        message: '在售房源调价需店长审批（演示环境暂未开放），请先下架后修改',
      });
    }
    data.area = nextArea;
    data.unitPrice = dto.totalPrice ? Math.round(nextTotal / nextArea) : nextUnit;
    data.totalPrice = nextTotal;

    const updated = await this.prisma.houseListing.update({ where: { id }, data, include: LISTING_INCLUDE });
    await this.audit.record('update_listing', 'listing', id, { code: updated.code, changed: Object.keys(dto) });
    return this.toDto(updated);
  }

  async submitVerify(user: AuthUser, id: string): Promise<unknown> {
    const listing = await this.findManageable(user, id);
    if (!['pending', 'offline'].includes(listing.status)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅待审核/已下架房源可提交验真' });
    }
    const attachments = await this.prisma.attachment.findMany({ where: { bizType: 'listing_agreement', bizId: id } });
    if (attachments.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '请先上传房屋出售委托协议后再提交验真' });
    }
    const updated = await this.prisma.houseListing.update({
      where: { id },
      data: { status: 'pending', verifyStatus: 'pending' },
      include: LISTING_INCLUDE,
    });
    await this.audit.record('submit_listing_verify', 'listing', id, { code: updated.code });
    return this.toDto(updated);
  }

  async publish(user: AuthUser, id: string): Promise<unknown> {
    const listing = await this.findManageable(user, id);
    if (listing.verifyStatus !== 'verified') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '房源未通过验真，不能上架' });
    }
    if (!['pending', 'offline'].includes(listing.status)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '当前状态不可上架' });
    }
    const updated = await this.prisma.houseListing.update({
      where: { id },
      data: { status: 'on_sale', listedAt: listing.listedAt ?? new Date() },
      include: LISTING_INCLUDE,
    });
    await this.audit.record('publish_listing', 'listing', id, { code: updated.code });
    await this.notify(updated.ownerId, 'system', '房源已上架', `您委托的房源 ${updated.code} 已上架，可在 C 端门户查看。`, 'listing', id);
    return this.toDto(updated);
  }

  async offline(user: AuthUser, id: string): Promise<unknown> {
    const listing = await this.findManageable(user, id);
    if (listing.status === 'signed') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '已签约房源不可下架' });
    }
    if (listing.status !== 'on_sale') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅在售房源可下架' });
    }
    const updated = await this.prisma.houseListing.update({
      where: { id },
      data: { status: 'offline' },
      include: LISTING_INCLUDE,
    });
    await this.audit.record('offline_listing', 'listing', id, { code: updated.code });
    return this.toDto(updated);
  }

  async verify(user: AuthUser, id: string, dto: VerifyListingDto): Promise<unknown> {
    if (!dto.pass && !dto.reason?.trim()) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '验真驳回必须填写原因' });
    }
    const listing = await this.prisma.houseListing.findFirst({ where: { id, isDeleted: false }, include: LISTING_INCLUDE });
    if (!listing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在' });

    const updated = await this.prisma.houseListing.update({
      where: { id },
      data: { verifyStatus: dto.pass ? 'verified' : 'rejected', status: dto.pass ? 'pending' : 'pending' },
      include: LISTING_INCLUDE,
    });
    await this.audit.record('verify_listing', 'listing', id, { code: updated.code, pass: dto.pass, reason: dto.reason ?? null });
    await this.notify(
      listing.agent.userId,
      'system',
      dto.pass ? '房源验真通过' : '房源验真驳回',
      dto.pass ? `房源 ${listing.code} 已通过验真，可上架展示。` : `房源 ${listing.code} 验真被驳回：${dto.reason ?? ''}`,
      'listing',
      id,
    );
    return this.toDto(updated);
  }

  // ---------- 内部方法 ----------

  private async scopeWhere(user: AuthUser): Promise<Prisma.HouseListingWhereInput> {
    if (user.role === 'admin') return { isDeleted: false };
    if (!user.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店，无法访问房源' });
    if (user.role === 'agent') {
      const agent = await this.prisma.agent.findUnique({ where: { userId: user.id } });
      if (!agent) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '经纪人档案不存在' });
      return { isDeleted: false, agentId: agent.id };
    }
    return { isDeleted: false, agencyId: user.agencyId };
  }

  private async findManageable(user: AuthUser, id: string): Promise<ListingRow> {
    const where = await this.scopeWhere(user);
    const listing = await this.prisma.houseListing.findFirst({ where: { AND: [where, { id }] }, include: LISTING_INCLUDE });
    if (!listing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在或无权操作' });
    return listing;
  }

  private async resolveAgent(user: AuthUser, agentId?: string): Promise<{ id: string; agencyId: string; userId: string } | null> {
    if (user.role === 'agent') {
      return this.prisma.agent.findUnique({ where: { userId: user.id }, select: { id: true, agencyId: true, userId: true } });
    }
    if (agentId) {
      const agent = await this.prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, agencyId: true, userId: true } });
      if (!agent) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '维护经纪人不存在' });
      if (user.role !== 'admin' && agent.agencyId !== user.agencyId) {
        throw new BadRequestException({ code: ERROR_CODES.FORBIDDEN, message: '只能选择本店经纪人' });
      }
      return agent;
    }
    if (user.agencyId) {
      return this.prisma.agent.findFirst({
        where: { agencyId: user.agencyId, status: 'active' },
        select: { id: true, agencyId: true, userId: true },
      });
    }
    return null;
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.houseListing.findFirst({
      where: { code: { startsWith: 'FC-901-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const seq = last ? Number(last.code.slice(-6)) + 1 : 1;
    return `FC-901-${String(seq).padStart(6, '0')}`;
  }

  private async notify(userId: string, type: string, title: string, content: string, bizType: string, bizId: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, title, content, bizType, bizId } });
  }

  private toDto(row: ListingRow): Record<string, unknown> {
    let images: Array<{ name: string; url: string }> = [];
    try {
      images = JSON.parse(row.imagesJson) as Array<{ name: string; url: string }>;
    } catch {
      images = [];
    }
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
      },
      owner: row.owner,
      agent: {
        id: row.agent.id,
        name: row.agent.user.name,
        phone: row.agent.user.phone,
        agencyId: row.agent.agencyId,
        agencyName: row.agent.agency.name,
      },
      agency: { id: row.agency.id, name: row.agency.name },
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
      images,
      address: row.address,
      lng: row.lng,
      lat: row.lat,
      listedAt: row.listedAt,
      soldAt: row.soldAt,
      viewCount: row.viewCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
