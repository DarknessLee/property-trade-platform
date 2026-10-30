import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { resolveScope } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import type { CreateConsultationDto, ListConsultationQueryDto, ReplyConsultationDto } from './dto';

const CONSULT_INCLUDE = {
  listing: {
    select: {
      id: true,
      code: true,
      title: true,
      totalPrice: true,
      area: true,
      status: true,
      community: { select: { name: true, district: true } },
    },
  },
  fromUser: { select: { id: true, name: true, phone: true, role: true } },
  toUser: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.ConsultationInclude;

type ConsultationRow = Prisma.ConsultationGetPayload<{ include: typeof CONSULT_INCLUDE }>;

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** C 端：在线咨询留言（买方/卖方） */
  async create(user: AuthUser, dto: CreateConsultationDto): Promise<unknown> {
    const listing = await this.prisma.houseListing.findFirst({
      where: { id: dto.listingId, isDeleted: false },
      include: { agent: { include: { user: true } }, community: true },
    });
    if (!listing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在' });
    if (listing.agent.user.id === user.id) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '不能咨询自己维护的房源' });
    }
    const code = await this.nextCode();
    const consultation = await this.prisma.consultation.create({
      data: {
        code,
        listingId: listing.id,
        fromUserId: user.id,
        toUserId: listing.agent.user.id,
        content: dto.content,
        status: 'pending',
      },
      include: CONSULT_INCLUDE,
    });
    await this.audit.record('create_consultation', 'consultation', consultation.id, { code, listingId: listing.id });
    await this.prisma.notification.create({
      data: {
        userId: listing.agent.user.id,
        type: 'showing',
        title: '新的房源咨询',
        content: `${user.name} 咨询房源「${listing.title}」：${dto.content.slice(0, 60)}`,
        bizType: 'consultation',
        bizId: consultation.id,
      },
    });
    return this.toDto(consultation);
  }

  /** C 端：我的咨询（含经纪人回复） */
  async myList(user: AuthUser): Promise<unknown[]> {
    const rows = await this.prisma.consultation.findMany({
      where: { fromUserId: user.id },
      include: CONSULT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toDto(row));
  }

  /** B 端：咨询收件箱（经纪人本人；店长/管理员本店） */
  async inbox(user: AuthUser, query: ListConsultationQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number; pendingCount: number }> {
    const where = await this.inboxWhere(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    if (query.status) where.status = query.status;
    const [rows, total, pendingCount] = await Promise.all([
      this.prisma.consultation.findMany({ where, include: CONSULT_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.consultation.count({ where }),
      this.prisma.consultation.count({ where: { AND: [await this.inboxWhere(user), { status: 'pending' }] } }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize, pendingCount };
  }

  async reply(user: AuthUser, id: string, dto: ReplyConsultationDto): Promise<unknown> {
    const row = await this.prisma.consultation.findUnique({ where: { id }, include: CONSULT_INCLUDE });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '咨询不存在' });
    const where = await this.inboxWhere(user);
    const allowed = await this.prisma.consultation.count({ where: { AND: [where, { id }] } });
    if (allowed === 0) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '无权回复该咨询' });
    if (row.status === 'replied') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '该咨询已回复，请勿重复回复' });
    }
    const updated = await this.prisma.consultation.update({
      where: { id },
      data: { replyContent: dto.content, repliedAt: new Date(), status: 'replied' },
      include: CONSULT_INCLUDE,
    });
    await this.audit.record('reply_consultation', 'consultation', id, { code: row.code });
    await this.prisma.notification.create({
      data: {
        userId: row.fromUserId,
        type: 'showing',
        title: '经纪人已回复您的咨询',
        content: `房源「${row.listing.title}」的咨询有新回复：${dto.content.slice(0, 60)}`,
        bizType: 'consultation',
        bizId: id,
      },
    });
    return this.toDto(updated);
  }

  private async inboxWhere(user: AuthUser): Promise<Prisma.ConsultationWhereInput> {
    if (user.role === 'admin') return {};
    const scope = await resolveScope(this.prisma, user);
    if (user.role === 'agent') return { toUserId: user.id };
    if (!scope.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店' });
    return { listing: { is: { agencyId: scope.agencyId } } };
  }

  private async nextCode(): Promise<string> {
    const year = dayjs().format('YYYY');
    const last = await this.prisma.consultation.findFirst({ where: { code: { startsWith: `ZX${year}` } }, orderBy: { code: 'desc' }, select: { code: true } });
    const seq = last ? Number(last.code.slice(6)) + 1 : 1;
    return `ZX${year}${String(seq).padStart(6, '0')}`;
  }

  private toDto(row: ConsultationRow): Record<string, unknown> {
    return {
      id: row.id,
      code: row.code,
      content: row.content,
      replyContent: row.replyContent,
      repliedAt: row.repliedAt,
      status: row.status,
      createdAt: row.createdAt,
      listing: row.listing,
      fromUser: row.fromUser,
      toUser: { id: row.toUser.id, name: row.toUser.name },
    };
  }
}
