import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { resolveAgentId, resolveScope } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import type { CreateCustomerDto, ListCustomersQueryDto, ProtectCustomerDto, UpdateCustomerDto } from './dto';

const CUSTOMER_INCLUDE = {
  agent: { include: { user: { select: { id: true, name: true, phone: true } }, agency: true } },
  agency: true,
  user: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.CustomerInclude;

type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof CUSTOMER_INCLUDE }>;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: ListCustomersQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = await this.scopeWhere(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    if (query.type) where.type = query.type;
    if (query.level) where.level = query.level;
    if (query.agentId) where.agentId = query.agentId;
    if (query.keyword) {
      where.OR = [{ name: { contains: query.keyword } }, { phone: { contains: query.keyword } }, { code: { contains: query.keyword } }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: CUSTOMER_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    const ids = rows.map((row) => row.id);
    const showingCounts = ids.length
      ? await this.prisma.showing.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, isDeleted: false }, _count: { _all: true } })
      : [];
    const showingMap = new Map(showingCounts.map((item) => [item.customerId, item._count._all]));
    return { items: rows.map((row) => this.toDto(row, showingMap.get(row.id) ?? 0)), total, page, pageSize };
  }

  async options(user: AuthUser): Promise<Array<{ id: string; name: string; phone: string; type: string; level: string }>> {
    const where = await this.scopeWhere(user);
    const rows = await this.prisma.customer.findMany({
      where,
      select: { id: true, name: true, phone: true, type: true, level: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return rows;
  }

  async detail(user: AuthUser, id: string): Promise<unknown> {
    const row = await this.findScoped(user, id);
    const showings = await this.prisma.showing.findMany({
      where: { customerId: id, isDeleted: false },
      include: { listing: { select: { id: true, code: true, title: true } }, agent: { include: { user: { select: { name: true } } } } },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
    });
    return { ...this.toDto(row, showings.length), showings };
  }

  async create(user: AuthUser, dto: CreateCustomerDto): Promise<unknown> {
    if (!user.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店' });
    const agentId = await resolveAgentId(this.prisma, user, (dto as CreateCustomerDto & { agentId?: string }).agentId);
    if (!agentId) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '请选择归属经纪人' });
    const agent = await this.prisma.agent.findUniqueOrThrow({ where: { id: agentId }, include: { agency: true } });

    // 防撞单：同门店、同手机号、保护期未过 → 拒绝
    const existing = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, agencyId: agent.agencyId, isDeleted: false },
    });
    if (existing && existing.protectionUntil && existing.protectionUntil > new Date()) {
      throw new BadRequestException({
        code: ERROR_CODES.CONFLICT,
        message: `该客户在保护期内（至 ${existing.protectionUntil.toLocaleDateString('zh-CN')}），归属经纪人：${existing.agentId}，不可重复录入`,
      });
    }

    const code = await this.nextCode();
    const customer = await this.prisma.customer.create({
      data: {
        code,
        name: dto.name,
        phone: dto.phone,
        type: dto.type,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        demand: dto.demand ?? '',
        tagsJson: JSON.stringify(dto.tags ?? []),
        agentId: agent.id,
        agencyId: agent.agencyId,
        level: dto.level ?? 'B',
        protectionUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        status: 'following',
      },
      include: CUSTOMER_INCLUDE,
    });
    await this.audit.record('create_customer', 'customer', customer.id, { code: customer.code, type: customer.type });
    return this.toDto(customer, 0);
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto): Promise<unknown> {
    const row = await this.findScoped(user, id);
    const updated = await this.prisma.customer.update({
      where: { id: row.id },
      data: {
        budgetMin: dto.budgetMin ?? row.budgetMin,
        budgetMax: dto.budgetMax ?? row.budgetMax,
        demand: dto.demand ?? row.demand,
        tagsJson: dto.tags ? JSON.stringify(dto.tags) : row.tagsJson,
        level: dto.level ?? row.level,
        status: dto.status ?? row.status,
      },
      include: CUSTOMER_INCLUDE,
    });
    await this.audit.record('update_customer', 'customer', id, { changed: Object.keys(dto) });
    return this.toDto(updated, 0);
  }

  async protect(user: AuthUser, id: string, dto: ProtectCustomerDto): Promise<unknown> {
    const row = await this.findScoped(user, id);
    if (row.agentId) {
      const myAgent = await this.prisma.agent.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (user.role === 'agent' && myAgent?.id !== row.agentId) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '只能为自己的客户设置保护期' });
      }
    }
    const days = dto.days ?? 30;
    const updated = await this.prisma.customer.update({
      where: { id: row.id },
      data: { protectionUntil: new Date(Date.now() + days * 24 * 3600 * 1000) },
      include: CUSTOMER_INCLUDE,
    });
    await this.audit.record('protect_customer', 'customer', id, { days });
    return this.toDto(updated, 0);
  }

  private async scopeWhere(user: AuthUser): Promise<Prisma.CustomerWhereInput> {
    const scope = await resolveScope(this.prisma, user);
    if (scope.isAdmin) return { isDeleted: false };
    if (!scope.agencyId) throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '账号未归属门店' });
    if (user.role === 'agent' && scope.agentId) return { isDeleted: false, agentId: scope.agentId };
    return { isDeleted: false, agencyId: scope.agencyId };
  }

  private async findScoped(user: AuthUser, id: string): Promise<CustomerRow> {
    const where = await this.scopeWhere(user);
    const row = await this.prisma.customer.findFirst({ where: { AND: [where, { id }] }, include: CUSTOMER_INCLUDE });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: '客户不存在或无权访问' });
    return row;
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.customer.findFirst({ where: { code: { startsWith: 'KH-' } }, orderBy: { code: 'desc' }, select: { code: true } });
    const seq = last ? Number(last.code.slice(3)) + 1 : 1;
    return `KH-${String(seq).padStart(6, '0')}`;
  }

  private toDto(row: CustomerRow, showingCount: number): Record<string, unknown> {
    let tags: string[] = [];
    try {
      tags = JSON.parse(row.tagsJson) as string[];
    } catch {
      tags = [];
    }
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone,
      type: row.type,
      budgetMin: row.budgetMin,
      budgetMax: row.budgetMax,
      demand: row.demand,
      tags,
      level: row.level,
      status: row.status,
      protectionUntil: row.protectionUntil,
      agent: { id: row.agent.id, name: row.agent.user.name, phone: row.agent.user.phone },
      agency: { id: row.agency.id, name: row.agency.name },
      user: row.user,
      showingCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
