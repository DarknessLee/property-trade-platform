import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { AuditService } from '../audit/audit.service';

export const MENU_KEYS = [
  '/admin',
  '/admin/listings',
  '/admin/approvals',
  '/admin/consultations',
  '/admin/communities',
  '/admin/customers',
  '/admin/showings',
  '/admin/contracts',
  '/admin/progress',
  '/admin/loans',
  '/admin/escrows',
  '/admin/transfers',
  '/admin/commissions',
  '/admin/agencies',
  '/admin/stats',
  '/admin/audit',
  '/admin/logs',
  '/admin/users',
  '/admin/complaints',
  '/admin/dicts',
  '/admin/templates',
];

const DEFAULT_MENU_KEYS: Record<string, string[]> = {
  agent: ['/admin', '/admin/listings', '/admin/approvals', '/admin/consultations', '/admin/customers', '/admin/showings', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers'],
  store_manager: ['/admin', '/admin/listings', '/admin/approvals', '/admin/consultations', '/admin/customers', '/admin/showings', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers', '/admin/commissions', '/admin/agencies', '/admin/stats'],
  finance: ['/admin', '/admin/contracts', '/admin/progress', '/admin/loans', '/admin/escrows', '/admin/transfers', '/admin/commissions', '/admin/finance', '/admin/stats'],
  admin: MENU_KEYS,
};

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

export class CreateAdminUserDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写姓名' })
  @MaxLength(20)
  name!: string;

  @IsIn(['agent', 'store_manager', 'finance', 'admin'])
  role!: string;

  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  password?: string;
}

export class UpdateAdminUserDto {
  @IsIn(['agent', 'store_manager', 'finance', 'admin'])
  role!: string;

  @IsOptional()
  @IsString()
  agencyId?: string;
}

export class CreateDictDto {
  @IsString()
  @IsNotEmpty({ message: '请填写分类' })
  category!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写键' })
  key!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写显示名' })
  label!: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateDictDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateMenuConfigDto {
  @IsIn(['agent', 'store_manager', 'finance', 'admin'])
  role!: string;

  @IsArray()
  @IsString({ each: true })
  menuKeys!: string[];
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

  async createUser(operator: AuthUser, dto: CreateAdminUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exists) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: '该手机号已注册' });
    if (dto.role !== 'admin' && !dto.agencyId) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '店长/财务/经纪人必须选择归属门店' });
    }
    const hash = bcrypt.hashSync(dto.password?.trim() || '123456', 10);
    const user = await this.prisma.user.create({
      data: { phone: dto.phone, name: dto.name, role: dto.role, agencyId: dto.agencyId ?? null, passwordHash: hash },
    });
    if (dto.role === 'agent' && dto.agencyId) {
      await this.prisma.agent.create({
        data: {
          userId: user.id,
          agencyId: dto.agencyId,
          licenseNo: `JJ${dayjs().format('YYYYMMDD')}${String(Math.floor(Math.random() * 9000) + 1000)}`,
          joinedAt: new Date(),
        },
      });
    }
    await this.audit.record('create_user', 'user', user.id, { role: dto.role, phone: dto.phone });
    return { id: user.id, phone: user.phone, name: user.name, role: user.role, agencyId: user.agencyId };
  }

  async updateUser(operator: AuthUser, id: string, dto: UpdateAdminUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '账号不存在' });
    if (dto.role === 'agent' && !dto.agencyId && !user.agencyId) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '经纪人必须选择归属门店' });
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role, ...(dto.agencyId !== undefined ? { agencyId: dto.agencyId } : {}) },
    });
    if (dto.role === 'agent' && (dto.agencyId ?? user.agencyId)) {
      const agent = await this.prisma.agent.findUnique({ where: { userId: id } });
      if (!agent) {
        await this.prisma.agent.create({
          data: {
            userId: id,
            agencyId: (dto.agencyId ?? user.agencyId) as string,
            licenseNo: `JJ${dayjs().format('YYYYMMDD')}${String(Math.floor(Math.random() * 9000) + 1000)}`,
            joinedAt: new Date(),
          },
        });
      }
    }
    await this.audit.record('update_user_role', 'user', id, { role: dto.role });
    return { id: updated.id, role: updated.role, agencyId: updated.agencyId };
  }

  async dicts() {
    const rows = await this.prisma.dataDict.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
    return rows;
  }

  async createDict(operator: AuthUser, dto: CreateDictDto) {
    const exists = await this.prisma.dataDict.findFirst({ where: { category: dto.category, key: dto.key } });
    if (exists) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: '该分类下的字典键已存在' });
    const row = await this.prisma.dataDict.create({
      data: { category: dto.category, key: dto.key, label: dto.label, value: dto.value ?? dto.label, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.audit.record('create_dict', 'data_dict', row.id, { category: dto.category, key: dto.key });
    return row;
  }

  async updateDict(operator: AuthUser, id: string, dto: UpdateDictDto) {
    const row = await this.prisma.dataDict.update({ where: { id }, data: { ...dto } });
    await this.audit.record('update_dict', 'data_dict', id, { ...dto });
    return row;
  }

  async deleteDict(operator: AuthUser, id: string) {
    await this.prisma.dataDict.delete({ where: { id } });
    await this.audit.record('delete_dict', 'data_dict', id, {});
    return { id, deleted: true };
  }

  async menuConfigs() {
    const rows = await this.prisma.roleMenuConfig.findMany();
    const map = new Map(rows.map((row) => [row.role, row]));
    return Object.keys(DEFAULT_MENU_KEYS).map((role) => {
      const row = map.get(role);
      let keys: string[] = DEFAULT_MENU_KEYS[role];
      if (row) {
        try {
          keys = JSON.parse(row.menuKeysJson) as string[];
        } catch {
          keys = DEFAULT_MENU_KEYS[role];
        }
      }
      return { role, menuKeys: keys };
    });
  }

  async myMenu(role: string) {
    const row = await this.prisma.roleMenuConfig.findUnique({ where: { role } });
    if (row) {
      try {
        return { role, menuKeys: JSON.parse(row.menuKeysJson) as string[] };
      } catch {
        return { role, menuKeys: DEFAULT_MENU_KEYS[role] ?? [] };
      }
    }
    return { role, menuKeys: DEFAULT_MENU_KEYS[role] ?? [] };
  }

  async updateMenu(operator: AuthUser, dto: UpdateMenuConfigDto) {
    const keys = dto.menuKeys.filter((key) => MENU_KEYS.includes(key));
    await this.prisma.roleMenuConfig.upsert({
      where: { role: dto.role },
      update: { menuKeysJson: JSON.stringify(keys) },
      create: { role: dto.role, menuKeysJson: JSON.stringify(keys) },
    });
    await this.audit.record('update_menu_config', 'role_menu', dto.role, { menuKeys: keys });
    return { role: dto.role, menuKeys: keys };
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

  @Post()
  @Roles('admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAdminUserDto): Promise<unknown> {
    return this.admin.createUser(user, dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAdminUserDto): Promise<unknown> {
    return this.admin.updateUser(user, id, dto);
  }
}

@Controller('admin')
export class AdminConfigController {
  constructor(private readonly admin: AdminService) {}

  @Get('dicts')
  @Roles('admin')
  dicts(): Promise<unknown> {
    return this.admin.dicts();
  }

  @Post('dicts')
  @Roles('admin')
  createDict(@CurrentUser() user: AuthUser, @Body() dto: CreateDictDto): Promise<unknown> {
    return this.admin.createDict(user, dto);
  }

  @Patch('dicts/:id')
  @Roles('admin')
  updateDict(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDictDto): Promise<unknown> {
    return this.admin.updateDict(user, id, dto);
  }

  @Delete('dicts/:id')
  @Roles('admin')
  deleteDict(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.admin.deleteDict(user, id);
  }

  @Get('menu-config/my')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  myMenu(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.admin.myMenu(user.role);
  }

  @Get('menu-config')
  @Roles('admin')
  menuConfigs(): Promise<unknown> {
    return this.admin.menuConfigs();
  }

  @Put('menu-config')
  @Roles('admin')
  updateMenu(@CurrentUser() user: AuthUser, @Body() dto: UpdateMenuConfigDto): Promise<unknown> {
    return this.admin.updateMenu(user, dto);
  }
}

@Module({
  controllers: [AdminAuditController, LogsController, UsersAdminController, AdminConfigController],
  providers: [AdminService],
})
export class AdminModule {}
