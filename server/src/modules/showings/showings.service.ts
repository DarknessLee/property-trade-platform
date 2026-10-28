import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { resolveScope } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import type { CreateShowingDto, ListShowingsQueryDto, UpdateShowingDto } from './dto';

const SHOWING_INCLUDE = {
  listing: { select: { id: true, code: true, title: true, totalPrice: true, area: true, community: { select: { name: true, district: true } } } },
  customer: { select: { id: true, code: true, name: true, phone: true, type: true, level: true, userId: true } },
  agent: { include: { user: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } } },
} satisfies Prisma.ShowingInclude;

type ShowingRow = Prisma.ShowingGetPayload<{ include: typeof SHOWING_INCLUDE }>;

@Injectable()
export class ShowingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: ListShowingsQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = await this.scopeWhere(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    if (query.status) where.status = query.status;
    if (query.agentId) where.agentId = query.agentId;
    if (query.dateFrom || query.dateTo) {
      where.scheduledAt = {
        ...(query.dateFrom ? { gte: dayjs(query.dateFrom).startOf('day').toDate() } : {}),
        ...(query.dateTo ? { lte: dayjs(query.dateTo).endOf('day').toDate() } : {}),
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.showing.findMany({
        where,
        include: SHOWING_INCLUDE,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.showing.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  /** 周历：返回该周 7 天的带看事件（按天分组） */
  async calendar(user: AuthUser, weekStart?: string): Promise<{ weekStart: string; days: Array<{ date: string; items: unknown[] }> }> {
    const start = dayjs(weekStart ?? dayjs().startOf('week').add(0, 'day')).startOf('day');
    const end = start.add(7, 'day');
    const where = await this.scopeWhere(user);
    where.scheduledAt = { gte: start.toDate(), lt: end.toDate() };
    const rows = await this.prisma.showing.findMany({ where, include: SHOWING_INCLUDE, orderBy: { scheduledAt: 'asc' } });
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = start.add(index, 'day').format('YYYY-MM-DD');
      return { date, items: rows.filter((row) => dayjs(row.scheduledAt).format('YYYY-MM-DD') === date).map((row) => this.toDto(row)) };
    });
    return { weekStart: start.format('YYYY-MM-DD'), days };
  }

  async create(user: AuthUser, dto: CreateShowingDto, allowCrossAgency = false): Promise<unknown> {
    const listing = await this.prisma.houseListing.findFirst({
      where: { id: dto.listingId, isDeleted: false },
      include: { agent: { include: { user: true } } },
    });
    if (!listing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在' });
    if (!['on_sale', 'signed'].includes(listing.status)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '该房源当前不可预约带看' });
    }

    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId ?? '', isDeleted: false } });
    if (!customer) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '请选择客户' });
    if (!allowCrossAgency && customer.agencyId !== listing.agencyId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '客户与房源不属于同一门店' });
    }

    const scheduledAt = dayjs(dto.scheduledAt);
    if (!scheduledAt.isValid()) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '预约时间格式不正确' });
    if (scheduledAt.isBefore(dayjs())) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '预约时间不能早于当前时间' });

    const agentId = listing.agentId;
    await this.assertNoConflict(agentId, scheduledAt.toDate(), dto.durationMin ?? 30);

    const code = `DK${scheduledAt.format('YYYYMMDD')}${String(await this.nextSeq()).padStart(4, '0')}`;
    const showing = await this.prisma.showing.create({
      data: {
        code,
        listingId: listing.id,
        customerId: customer.id,
        agentId,
        scheduledAt: scheduledAt.toDate(),
        durationMin: dto.durationMin ?? 30,
        status: 'pending',
      },
      include: SHOWING_INCLUDE,
    });

    await this.audit.record('create_showing', 'showing', showing.id, { code: showing.code });
    await this.notify(listing.agent.userId, 'showing', '新的带看预约', `客户 ${customer.name} 预约 ${scheduledAt.format('MM月DD日 HH:mm')} 带看「${listing.title}」，请及时确认。`, 'showing', showing.id);
    if (customer.userId) {
      await this.notify(customer.userId, 'showing', '带看预约已提交', `您预约的「${listing.title}」带看已提交，经纪人确认后将通知您。`, 'showing', showing.id);
    }
    return this.toDto(showing);
  }

  async update(user: AuthUser, id: string, dto: UpdateShowingDto): Promise<unknown> {
    const showing = await this.findScoped(user, id);
    if (showing.status === 'done') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '已完成的带看不可修改' });
    }
    const nextStatus = dto.status ?? showing.status;
    const allowed: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['done', 'cancelled'],
      done: [],
      cancelled: [],
    };
    if (dto.status && !allowed[showing.status]?.includes(nextStatus)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: `带看状态不可从「${showing.status}」变更为「${nextStatus}」` });
    }
    if (nextStatus === 'done' && !dto.feedback?.trim()) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '完成带看需填写带看反馈' });
    }

    const updated = await this.prisma.showing.update({
      where: { id },
      data: {
        status: nextStatus,
        actualAt: nextStatus === 'done' ? (dto.actualAt ? new Date(dto.actualAt) : new Date()) : showing.actualAt,
        feedback: dto.feedback ?? showing.feedback,
        rating: dto.rating ?? showing.rating,
      },
      include: SHOWING_INCLUDE,
    });

    if (nextStatus === 'done' && dto.rating) {
      await this.prisma.customer.update({ where: { id: showing.customerId }, data: { level: dto.rating } });
    }
    await this.audit.record('update_showing', 'showing', id, { status: nextStatus, rating: dto.rating ?? null });
    if (nextStatus === 'confirmed' && showing.customer.userId) {
      await this.notify(showing.customer.userId, 'showing', '带看已确认', `经纪人已确认 ${dayjs(showing.scheduledAt).format('MM月DD日 HH:mm')} 的带看安排。`, 'showing', id);
    }
    return this.toDto(updated);
  }

  /** C 端：我的带看 */
  async myList(user: AuthUser): Promise<unknown[]> {
    const customer = await this.prisma.customer.findFirst({ where: { userId: user.id, isDeleted: false } });
    if (!customer) return [];
    const rows = await this.prisma.showing.findMany({
      where: { customerId: customer.id, isDeleted: false },
      include: SHOWING_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toDto(row));
  }

  /** C 端：预约带看（需已有客户档案，经纪人=房源维护人） */
  async myCreate(user: AuthUser, dto: CreateShowingDto): Promise<unknown> {
    const customer = await this.prisma.customer.findFirst({ where: { userId: user.id, isDeleted: false } });
    if (!customer) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '您还没有客户档案，请先在个人中心联系经纪人建档' });
    }
    return this.create(user, { ...dto, customerId: customer.id }, true);
  }

  async myCancel(user: AuthUser, id: string): Promise<unknown> {
    const customer = await this.prisma.customer.findFirst({ where: { userId: user.id, isDeleted: false } });
    const showing = await this.prisma.showing.findFirst({ where: { id, customerId: customer?.id ?? '', isDeleted: false } });
    if (!showing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '带看记录不存在' });
    if (!['pending', 'confirmed'].includes(showing.status)) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '当前状态不可取消' });
    }
    const updated = await this.prisma.showing.update({ where: { id }, data: { status: 'cancelled' }, include: SHOWING_INCLUDE });
    await this.audit.record('cancel_showing', 'showing', id, { by: 'customer' });
    return this.toDto(updated);
  }

  // ---------- 内部 ----------

  private async assertNoConflict(agentId: string, start: Date, durationMin: number): Promise<void> {
    const windowStart = new Date(start.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(start.getTime() + (durationMin + 30) * 60 * 1000);
    const conflict = await this.prisma.showing.findFirst({
      where: {
        agentId,
        isDeleted: false,
        status: { in: ['pending', 'confirmed'] },
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
    });
    if (conflict) {
      throw new BadRequestException({
        code: ERROR_CODES.BUSINESS_RULE,
        message: `经纪人在该时段已有带看安排（${dayjs(conflict.scheduledAt).format('MM月DD日 HH:mm')}），请选择其他时间`,
      });
    }
  }

  private async scopeWhere(user: AuthUser): Promise<Prisma.ShowingWhereInput> {
    const scope = await resolveScope(this.prisma, user);
    if (scope.isAdmin) return { isDeleted: false };
    if (!scope.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店' });
    if (user.role === 'agent' && scope.agentId) return { isDeleted: false, agentId: scope.agentId };
    return { isDeleted: false, agent: { agencyId: scope.agencyId } };
  }

  private async findScoped(user: AuthUser, id: string): Promise<ShowingRow> {
    const where = await this.scopeWhere(user);
    const row = await this.prisma.showing.findFirst({ where: { AND: [where, { id }] }, include: SHOWING_INCLUDE });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '带看记录不存在或无权访问' });
    return row;
  }

  private async nextSeq(): Promise<number> {
    return (await this.prisma.showing.count({ where: { code: { startsWith: `DK${dayjs().format('YYYYMMDD')}` } } })) + 1;
  }

  private async notify(userId: string, type: string, title: string, content: string, bizType: string, bizId: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, title, content, bizType, bizId } });
  }

  private toDto(row: ShowingRow): Record<string, unknown> {
    return {
      id: row.id,
      code: row.code,
      listing: row.listing,
      customer: row.customer,
      agent: { id: row.agent.id, name: row.agent.user.name, agency: row.agent.agency },
      scheduledAt: row.scheduledAt,
      actualAt: row.actualAt,
      durationMin: row.durationMin,
      status: row.status,
      feedback: row.feedback,
      rating: row.rating,
      createdAt: row.createdAt,
    };
  }
}
