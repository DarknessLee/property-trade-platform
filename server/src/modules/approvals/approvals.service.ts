import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { resolveScope } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import type { CreatePriceApprovalDto, ListApprovalQueryDto, ReviewApprovalDto } from './dto';

const APPROVAL_INCLUDE = {
  listing: {
    select: {
      id: true,
      code: true,
      title: true,
      totalPrice: true,
      unitPrice: true,
      area: true,
      status: true,
      community: { select: { name: true, district: true } },
      agent: { include: { user: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.ApprovalRequestInclude;

type ApprovalRow = Prisma.ApprovalRequestGetPayload<{ include: typeof APPROVAL_INCLUDE }>;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: ListApprovalQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = await this.scopeWhere(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    if (query.status) where.status = query.status;
    const [rows, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({ where, include: APPROVAL_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.approvalRequest.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string): Promise<unknown> {
    const row = await this.findScoped(user, id);
    return this.toDto(row);
  }

  /** 发起在售调价审批（经纪人/店长/管理员） */
  async createPriceChange(user: AuthUser, dto: CreatePriceApprovalDto): Promise<unknown> {
    const listing = await this.prisma.houseListing.findFirst({
      where: { id: dto.listingId, isDeleted: false },
      include: { agent: { include: { user: true } }, community: true },
    });
    if (!listing) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在' });
    if (listing.status !== 'on_sale') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅「在售」房源可发起调价审批' });
    }
    if (user.role === 'agent') {
      const agent = await this.prisma.agent.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!agent || listing.agentId !== agent.id) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '只能为本人的房源发起调价审批' });
      }
    } else if (user.role === 'store_manager' && listing.agencyId !== user.agencyId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '只能为本店房源发起调价审批' });
    }
    if (dto.newTotalPrice === listing.totalPrice) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '新总价与当前挂牌价一致，无需调价' });
    }
    const pending = await this.prisma.approvalRequest.findFirst({ where: { listingId: listing.id, type: 'price_change', status: 'pending' } });
    if (pending) {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: `该房源已有待审批的调价申请（${pending.code}），请勿重复提交` });
    }

    const code = await this.nextCode();
    const newUnitPrice = Math.round(dto.newTotalPrice / listing.area);
    const approval = await this.prisma.approvalRequest.create({
      data: {
        code,
        type: 'price_change',
        status: 'pending',
        listingId: listing.id,
        requesterId: user.id,
        requesterName: user.name,
        payloadJson: JSON.stringify({
          oldTotalPrice: listing.totalPrice,
          newTotalPrice: dto.newTotalPrice,
          oldUnitPrice: listing.unitPrice,
          newUnitPrice,
          reason: dto.reason,
        }),
        reason: dto.reason,
      },
      include: APPROVAL_INCLUDE,
    });
    await this.audit.record('create_approval', 'approval', approval.id, { type: 'price_change', code });
    await this.notifyApprovers(listing.agencyId, approval.id, code, listing.title, listing.totalPrice, dto.newTotalPrice);
    return this.toDto(approval);
  }

  async approve(user: AuthUser, id: string, dto: ReviewApprovalDto): Promise<unknown> {
    const row = await this.findReviewable(user, id);
    const payload = JSON.parse(row.payloadJson) as { oldTotalPrice: number; newTotalPrice: number; oldUnitPrice: number; newUnitPrice: number };
    const reviewedAt = new Date();
    const [approval] = await this.prisma.$transaction([
      this.prisma.approvalRequest.update({
        where: { id },
        data: { status: 'approved', approverId: user.id, approverName: user.name, reviewComment: dto.comment ?? '同意调价', reviewedAt },
        include: APPROVAL_INCLUDE,
      }),
      this.prisma.houseListing.update({
        where: { id: row.listingId as string },
        data: { totalPrice: payload.newTotalPrice, unitPrice: payload.newUnitPrice },
      }),
      this.prisma.priceHistory.create({
        data: {
          listingId: row.listingId as string,
          price: payload.newTotalPrice,
          unitPrice: payload.newUnitPrice,
          source: 'approval',
          remark: `调价审批通过（${row.code}）`,
          changedAt: reviewedAt,
        },
      }),
    ]);
    await this.audit.record('approve_approval', 'approval', id, { code: row.code, newTotalPrice: payload.newTotalPrice });
    await this.notify(row.requesterId, 'approval', '调价审批已通过', `房源「${row.listing?.title ?? ''}」调价申请（${row.code}）已通过，挂牌价已更新为 ${payload.newTotalPrice.toLocaleString()} 元。`, id);
    return this.toDto(approval);
  }

  async reject(user: AuthUser, id: string, dto: ReviewApprovalDto): Promise<unknown> {
    const row = await this.findReviewable(user, id);
    if (!dto.comment?.trim()) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '驳回必须填写意见' });
    }
    const approval = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'rejected', approverId: user.id, approverName: user.name, reviewComment: dto.comment, reviewedAt: new Date() },
      include: APPROVAL_INCLUDE,
    });
    await this.audit.record('reject_approval', 'approval', id, { code: row.code, comment: dto.comment });
    await this.notify(row.requesterId, 'approval', '调价审批被驳回', `房源「${row.listing?.title ?? ''}」调价申请（${row.code}）被驳回：${dto.comment}`, id);
    return this.toDto(approval);
  }

  // ---------- 内部 ----------

  private async scopeWhere(user: AuthUser): Promise<Prisma.ApprovalRequestWhereInput> {
    if (user.role === 'admin') return {};
    const scope = await resolveScope(this.prisma, user);
    if (user.role === 'agent') return { requesterId: user.id };
    if (!scope.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店' });
    return { listing: { is: { agencyId: scope.agencyId } } };
  }

  private async findScoped(user: AuthUser, id: string): Promise<ApprovalRow> {
    const where = await this.scopeWhere(user);
    const row = await this.prisma.approvalRequest.findFirst({ where: { AND: [where, { id }] }, include: APPROVAL_INCLUDE });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '审批单不存在或无权访问' });
    return row;
  }

  private async findReviewable(user: AuthUser, id: string): Promise<ApprovalRow> {
    const row = await this.findScoped(user, id);
    if (row.status !== 'pending') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '该审批单已处理，不能重复审批' });
    }
    if (row.requesterId === user.id) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '不能审批自己提交的申请' });
    }
    return row;
  }

  private async notifyApprovers(agencyId: string, approvalId: string, code: string, listingTitle: string, oldPrice: number, newPrice: number): Promise<void> {
    const managers = await this.prisma.user.findMany({ where: { role: 'store_manager', agencyId, status: 'active' }, select: { id: true } });
    const admins = await this.prisma.user.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const target of [...managers, ...admins]) {
      await this.prisma.notification.create({
        data: {
          userId: target.id,
          type: 'approval',
          title: '新的调价审批',
          content: `房源「${listingTitle}」申请调价：${oldPrice.toLocaleString()} → ${newPrice.toLocaleString()} 元（${code}），请及时审批。`,
          bizType: 'approval',
          bizId: approvalId,
        },
      });
    }
  }

  private async notify(userId: string, type: string, title: string, content: string, bizId: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, title, content, bizType: 'approval', bizId } });
  }

  private async nextCode(): Promise<string> {
    const year = dayjs().format('YYYY');
    const last = await this.prisma.approvalRequest.findFirst({ where: { code: { startsWith: `AP${year}` } }, orderBy: { code: 'desc' }, select: { code: true } });
    const seq = last ? Number(last.code.slice(6)) + 1 : 1;
    return `AP${year}${String(seq).padStart(6, '0')}`;
  }

  private toDto(row: ApprovalRow): Record<string, unknown> {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      status: row.status,
      reason: row.reason,
      payload,
      reviewComment: row.reviewComment,
      requester: { id: row.requesterId, name: row.requesterName },
      approver: row.approverId ? { id: row.approverId, name: row.approverName } : null,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      listing: row.listing
        ? {
            id: row.listing.id,
            code: row.listing.code,
            title: row.listing.title,
            totalPrice: row.listing.totalPrice,
            unitPrice: row.listing.unitPrice,
            area: row.listing.area,
            status: row.listing.status,
            community: row.listing.community,
            agent: { id: row.listing.agent.id, name: row.listing.agent.user.name },
          }
        : null,
    };
  }
}
