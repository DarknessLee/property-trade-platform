import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { AuditService } from '../audit/audit.service';

export class ReviewRealNameDto {
  @IsIn([true, false])
  pass!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class UpdateUserStatusDto {
  @IsIn(['active', 'disabled'])
  status!: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async realNameAudits(status = 'pending', page = 1, pageSize = 10) {
    const where = { status };
    const [rows, total] = await Promise.all([
      this.prisma.realNameAuth.findMany({
        where,
        include: { user: { select: { id: true, name: true, phone: true, role: true } } },
        orderBy: { submittedAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.realNameAuth.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        realName: row.realName,
        idCardMasked: row.idCardMasked,
        status: row.status,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        rejectReason: row.rejectReason,
        user: row.user,
      })),
      total,
      page,
      pageSize,
    };
  }

  async reviewRealName(operator: AuthUser, id: string, dto: ReviewRealNameDto) {
    if (!dto.pass && !dto.reason?.trim()) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '驳回必须填写原因' });
    }
    const record = await this.prisma.realNameAuth.findUnique({ where: { id }, include: { user: true } });
    if (!record) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '实名记录不存在' });

    const updated = await this.prisma.realNameAuth.update({
      where: { id },
      data: {
        status: dto.pass ? 'approved' : 'rejected',
        rejectReason: dto.pass ? null : dto.reason,
        reviewedAt: new Date(),
        reviewerId: operator.id,
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: record.userId,
        type: 'system',
        title: dto.pass ? '实名认证已通过' : '实名认证被驳回',
        content: dto.pass ? '您的实名认证已通过审核，可正常进行交易操作。' : `您的实名认证被驳回：${dto.reason ?? ''}，请修改后重新提交。`,
        bizType: 'realname',
        bizId: id,
      },
    });
    await this.audit.record('review_realname', 'real_name_auth', id, { pass: dto.pass });
    return { id: updated.id, status: updated.status };
  }

  async logs(query: { action?: string; userId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 20);
    const where: Record<string, unknown> = {};
    if (query.action) where.action = { contains: query.action };
    if (query.userId) where.userId = query.userId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59`) } : {}),
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.operationLog.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        detail: row.detail,
        ip: row.ip,
        createdAt: row.createdAt,
        user: row.user,
      })),
      total,
      page,
      pageSize,
    };
  }

  async users(query: { role?: string; keyword?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 10);
    const where: Record<string, unknown> = { isDeleted: false };
    if (query.role) where.role = query.role;
    if (query.keyword) where.OR = [{ name: { contains: query.keyword } }, { phone: { contains: query.keyword } }];
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, phone: true, role: true, status: true, agencyId: true, createdAt: true, agency: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map((row) => ({ ...row, agencyName: row.agency?.name ?? null })), total, page, pageSize };
  }

  async setUserStatus(operator: AuthUser, id: string, status: string) {
    if (operator.id === id) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '不能禁用自己的账号' });
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { status } });
    await this.audit.record('update_user_status', 'user', id, { status });
    return { id: updated.id, status: updated.status };
  }

  async resetPassword(operator: AuthUser, id: string) {
    const hash = bcrypt.hashSync('123456', 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    await this.audit.record('reset_password', 'user', id, {});
    return { id, resetTo: '123456' };
  }
}

@Controller('admin')
export class AdminAuditController {
  constructor(private readonly admin: AdminService) {}

  @Get('audits/realnames')
  @Roles('admin')
  realNames(@Query('status') status?: string, @Query('page') page?: string): Promise<unknown> {
    return this.admin.realNameAudits(status ?? 'pending', Number(page) || 1);
  }

  @Post('audits/realnames/:id')
  @Roles('admin')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewRealNameDto): Promise<unknown> {
    return this.admin.reviewRealName(user, id, dto);
  }
}

@Controller('logs')
export class LogsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @Roles('admin')
  list(
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<unknown> {
    return this.admin.logs({ action, userId, dateFrom, dateTo, page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  }
}

@Controller('users')
export class UsersAdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @Roles('admin')
  list(@Query('role') role?: string, @Query('keyword') keyword?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string): Promise<unknown> {
    return this.admin.users({ role, keyword, page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Patch(':id/status')
  @Roles('admin')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserStatusDto): Promise<unknown> {
    return this.admin.setUserStatus(user, id, dto.status);
  }

  @Post(':id/reset-password')
  @Roles('admin')
  reset(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.admin.resetPassword(user, id);
  }
}

@Module({
  controllers: [AdminAuditController, LogsController, UsersAdminController],
  providers: [AdminService],
})
export class AdminModule {}
