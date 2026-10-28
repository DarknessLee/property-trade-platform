import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { AuditService } from '../audit/audit.service';

export class CreateAgencyDto {
  @IsString()
  @IsNotEmpty({ message: '请填写门店名称' })
  @MaxLength(50)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写资质编号' })
  licenseNo!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写地址' })
  address!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写电话' })
  phone!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

async function agencyStats(prisma: PrismaService, agencyIds: string[]) {
  const [agents, listings, onSale, customers, showings, contracts] = await Promise.all([
    prisma.agent.count({ where: { agencyId: { in: agencyIds }, isDeleted: false } }),
    prisma.houseListing.count({ where: { agencyId: { in: agencyIds }, isDeleted: false } }),
    prisma.houseListing.count({ where: { agencyId: { in: agencyIds }, status: 'on_sale', isDeleted: false } }),
    prisma.customer.count({ where: { agencyId: { in: agencyIds }, isDeleted: false } }),
    prisma.showing.count({ where: { agent: { agencyId: { in: agencyIds } }, isDeleted: false } }),
    prisma.contract.findMany({
      where: { agencyId: { in: agencyIds }, signStatus: 'signed', isDeleted: false },
      select: { amount: true, commissionAmount: true },
    }),
  ]);
  return {
    agentCount: agents,
    listingCount: listings,
    onSaleCount: onSale,
    customerCount: customers,
    showingCount: showings,
    signedContractCount: contracts.length,
    dealAmount: contracts.reduce((sum, item) => sum + item.amount, 0),
    commissionAmount: contracts.reduce((sum, item) => sum + item.commissionAmount, 0),
  };
}

@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async tree(user: AuthUser): Promise<unknown[]> {
    const where = user.role === 'admin' ? { isDeleted: false, parentId: null } : { isDeleted: false, id: user.agencyId ?? '' };
    const nodes = await this.prisma.agency.findMany({ where, include: { children: { where: { isDeleted: false } } }, orderBy: { createdAt: 'asc' } });
    const result: unknown[] = [];
    for (const node of nodes) {
      const ids = [node.id, ...node.children.map((child) => child.id)];
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        licenseNo: node.licenseNo,
        address: node.address,
        phone: node.phone,
        stats: await agencyStats(this.prisma, ids),
        children: await Promise.all(
          node.children.map(async (child) => ({
            id: child.id,
            name: child.name,
            type: child.type,
            licenseNo: child.licenseNo,
            address: child.address,
            phone: child.phone,
            stats: await agencyStats(this.prisma, [child.id]),
          })),
        ),
      });
    }
    return result;
  }

  async create(dto: CreateAgencyDto): Promise<unknown> {
    const exists = await this.prisma.agency.findFirst({ where: { licenseNo: dto.licenseNo, isDeleted: false } });
    if (exists) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: '该资质编号已存在' });
    const parent = dto.parentId
      ? await this.prisma.agency.findUnique({ where: { id: dto.parentId } })
      : await this.prisma.agency.findFirst({ where: { type: 'hq', isDeleted: false } });
    const agency = await this.prisma.agency.create({
      data: {
        name: dto.name,
        type: 'store',
        licenseNo: dto.licenseNo,
        address: dto.address,
        phone: dto.phone,
        parentId: parent?.id ?? null,
      },
    });
    await this.audit.record('create_agency', 'agency', agency.id, { name: agency.name });
    return agency;
  }

  async agents(user: AuthUser, agencyId?: string): Promise<unknown[]> {
    const target = user.role === 'admin' ? agencyId : (user.agencyId ?? undefined);
    const agents = await this.prisma.agent.findMany({
      where: { isDeleted: false, ...(user.role === 'agent' ? { userId: user.id } : target ? { agencyId: target } : {}) },
      include: { user: { select: { id: true, name: true, phone: true, status: true } }, agency: true },
      orderBy: { joinedAt: 'asc' },
    });
    const result: unknown[] = [];
    for (const agent of agents) {
      const [listings, customers, showings, contracts] = await Promise.all([
        this.prisma.houseListing.count({ where: { agentId: agent.id, isDeleted: false } }),
        this.prisma.customer.count({ where: { agentId: agent.id, isDeleted: false } }),
        this.prisma.showing.count({ where: { agentId: agent.id, isDeleted: false } }),
        this.prisma.contract.findMany({ where: { agentId: agent.id, signStatus: 'signed', isDeleted: false }, select: { amount: true } }),
      ]);
      result.push({
        id: agent.id,
        userId: agent.user.id,
        name: agent.user.name,
        phone: agent.user.phone,
        title: agent.title,
        licenseNo: agent.licenseNo,
        status: agent.status,
        userStatus: agent.user.status,
        agency: { id: agent.agency.id, name: agent.agency.name },
        joinedAt: agent.joinedAt,
        stats: {
          listingCount: listings,
          customerCount: customers,
          showingCount: showings,
          signedContractCount: contracts.length,
          dealAmount: contracts.reduce((sum, item) => sum + item.amount, 0),
        },
      });
    }
    return result;
  }

  async updateAgent(user: AuthUser, id: string, body: { title?: string; status?: string }): Promise<unknown> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '经纪人不存在' });
    if (user.role === 'store_manager' && agent.agencyId !== user.agencyId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: '只能管理本店经纪人' });
    }
    const updated = await this.prisma.agent.update({
      where: { id },
      data: { title: body.title ?? agent.title, status: body.status ?? agent.status },
      include: { user: { select: { id: true, name: true, phone: true, status: true } }, agency: true },
    });
    await this.audit.record('update_agent', 'agent', id, body);
    return { id: updated.id, title: updated.title, status: updated.status, userStatus: updated.user.status };
  }
}

@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agencies: AgenciesService) {}

  @Get()
  @Roles('store_manager', 'finance', 'admin')
  tree(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.agencies.tree(user);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateAgencyDto): Promise<unknown> {
    return this.agencies.create(dto);
  }

  @Get('agents')
  @Roles('agent', 'store_manager', 'admin')
  agents(@CurrentUser() user: AuthUser, @Query('agencyId') agencyId?: string): Promise<unknown[]> {
    return this.agencies.agents(user, agencyId);
  }
}

@Controller('agents')
export class AgentsController {
  constructor(private readonly agencies: AgenciesService) {}

  @Get()
  @Roles('agent', 'store_manager', 'admin')
  list(@CurrentUser() user: AuthUser, @Query('agencyId') agencyId?: string): Promise<unknown[]> {
    return this.agencies.agents(user, agencyId);
  }

  @Post(':id')
  @Roles('store_manager', 'admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { title?: string; status?: string }): Promise<unknown> {
    return this.agencies.updateAgent(user, id, body);
  }
}

@Module({
  controllers: [AgenciesController, AgentsController],
  providers: [AgenciesService],
})
export class AgenciesModule {}
