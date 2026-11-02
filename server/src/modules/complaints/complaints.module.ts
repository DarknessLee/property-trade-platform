import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { AuditService } from '../audit/audit.service';
import dayjs from 'dayjs';

export class CreateComplaintDto {
  @IsIn(['listing_quality', 'service', 'price', 'false_info', 'other'])
  type!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写投诉内容' })
  @MaxLength(500)
  content!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写联系人' })
  @MaxLength(20)
  contactName!: string;

  @Matches(/^1[3-9]\d{9}$/, { message: '联系电话格式不正确' })
  contactPhone!: string;

  @IsOptional()
  @IsString()
  listingId?: string;
}

export class HandleComplaintDto {
  @IsIn(['processing', 'resolved', 'rejected'])
  status!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写处理意见' })
  @MaxLength(300)
  comment!: string;
}

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthUser, dto: CreateComplaintDto): Promise<unknown> {
    if (dto.listingId) {
      const listing = await this.prisma.houseListing.findFirst({ where: { id: dto.listingId, isDeleted: false } });
      if (!listing) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '房源不存在' });
    }
    const code = `TS${dayjs().format('YYYY')}${String((await this.prisma.complaint.count()) + 1).padStart(6, '0')}`;
    const complaint = await this.prisma.complaint.create({
      data: {
        code,
        type: dto.type,
        content: dto.content,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        listingId: dto.listingId ?? null,
        complainantUserId: user.id,
        status: 'pending',
      },
    });
    await this.audit.record('create_complaint', 'complaint', complaint.id, { code });
    await this.notifyAdmins('新的投诉待处理', `投诉单 ${code}：${dto.content.slice(0, 50)}`, complaint.id);
    return complaint;
  }

  async my(user: AuthUser): Promise<unknown[]> {
    return this.prisma.complaint.findMany({
      where: { complainantUserId: user.id },
      include: { listing: { select: { id: true, title: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async list(query: { status?: string; page?: number; pageSize?: number }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 10);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: { listing: { select: { id: true, title: true, code: true, community: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.complaint.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async handle(user: AuthUser, id: string, dto: HandleComplaintDto): Promise<unknown> {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '投诉单不存在' });
    if (complaint.status === 'resolved' || complaint.status === 'rejected') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '该投诉已处理完成' });
    }
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: { status: dto.status, handleComment: dto.comment, handlerId: user.id, handlerName: user.name, handledAt: new Date() },
    });
    await this.audit.record('handle_complaint', 'complaint', id, { status: dto.status });
    if (complaint.complainantUserId) {
      await this.prisma.notification.create({
        data: {
          userId: complaint.complainantUserId,
          type: 'system',
          title: '投诉处理进展',
          content: `您的投诉单（${complaint.code}）状态更新为：${dto.status === 'resolved' ? '已解决' : dto.status === 'rejected' ? '已驳回' : '处理中'}。${dto.comment}`,
          bizType: 'complaint',
          bizId: id,
        },
      });
    }
    return updated;
  }

  private async notifyAdmins(title: string, content: string, bizId: string): Promise<void> {
    const admins = await this.prisma.user.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const admin of admins) {
      await this.prisma.notification.create({ data: { userId: admin.id, type: 'system', title, content, bizType: 'complaint', bizId } });
    }
  }
}

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Post()
  @Roles('buyer', 'seller')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateComplaintDto): Promise<unknown> {
    return this.complaints.create(user, dto);
  }

  @Get('my')
  @Roles('buyer', 'seller')
  my(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.complaints.my(user);
  }

  @Get()
  @Roles('admin')
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.complaints.list({ status, page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Post(':id/handle')
  @Roles('admin')
  handle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: HandleComplaintDto): Promise<unknown> {
    return this.complaints.handle(user, id, dto);
  }
}

@Module({
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
