import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles, type AuthUser, CurrentUser } from '../../common/decorators';

/** 下拉选项：业主（卖方）、维护经纪人 */
@Controller()
export class OptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users/options')
  @Roles('agent', 'store_manager', 'admin')
  async sellerOptions(@Query('role') role = 'seller'): Promise<Array<{ id: string; name: string; phone: string }>> {
    const safeRole = ['seller', 'buyer', 'agent', 'store_manager', 'finance', 'admin'].includes(role) ? role : 'seller';
    return this.prisma.user.findMany({
      where: { role: safeRole, isDeleted: false, status: 'active' },
      select: { id: true, name: true, phone: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('agents/options')
  @Roles('agent', 'store_manager', 'admin')
  async agentOptions(
    @CurrentUser() user: AuthUser,
    @Query('agencyId') agencyId?: string,
  ): Promise<Array<{ id: string; name: string; agencyId: string; title: string }>> {
    const targetAgency = user.role === 'admin' ? agencyId : user.agencyId ?? undefined;
    const rows = await this.prisma.agent.findMany({
      where: { status: 'active', isDeleted: false, ...(targetAgency ? { agencyId: targetAgency } : {}) },
      select: { id: true, title: true, agencyId: true, user: { select: { name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((row) => ({ id: row.id, name: row.user.name, agencyId: row.agencyId, title: row.title }));
  }
}
