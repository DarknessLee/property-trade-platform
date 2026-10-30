import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './decorators';

export interface DataScope {
  isAdmin: boolean;
  agencyId: string | null;
  agentId: string | null;
}

/** 解析员工数据范围：管理员=全平台；经纪人=本人；店长/财务=本店 */
export async function resolveScope(prisma: PrismaService, user: AuthUser): Promise<DataScope> {
  if (user.role === 'admin') return { isAdmin: true, agencyId: null, agentId: null };
  if (user.role === 'agent') {
    const agent = await prisma.agent.findUnique({ where: { userId: user.id }, select: { id: true, agencyId: true } });
    return { isAdmin: false, agencyId: agent?.agencyId ?? user.agencyId ?? null, agentId: agent?.id ?? null };
  }
  return { isAdmin: false, agencyId: user.agencyId ?? null, agentId: null };
}

/** 合同数据范围：买方/卖方=本人；经纪人=本人维护；店长/财务=本店（财务总部含门店树）；管理员=全部 */
export async function contractScopeWhere(prisma: PrismaService, user: AuthUser): Promise<Prisma.ContractWhereInput> {
  if (user.role === 'buyer' || user.role === 'seller') {
    return {
      isDeleted: false,
      OR: [{ buyerCustomer: { is: { userId: user.id } } }, { sellerCustomer: { is: { userId: user.id } } }],
    };
  }
  const scope = await resolveScope(prisma, user);
  if (scope.isAdmin) return { isDeleted: false };
  if (!scope.agencyId) return { isDeleted: false, id: '__none__' };
  if (user.role === 'agent' && scope.agentId) return { isDeleted: false, agentId: scope.agentId };
  if (user.role === 'finance') {
    const agency = await prisma.agency.findUnique({ where: { id: scope.agencyId }, select: { id: true, parentId: true } });
    if (agency && !agency.parentId) {
      const children = await prisma.agency.findMany({ where: { parentId: agency.id }, select: { id: true } });
      return { isDeleted: false, agencyId: { in: [agency.id, ...children.map((item) => item.id)] } };
    }
  }
  return { isDeleted: false, agencyId: scope.agencyId };
}

/** 经纪人档案（用于创建业务时自动归属） */
export async function resolveAgentId(prisma: PrismaService, user: AuthUser, explicitAgentId?: string): Promise<string | null> {
  if (user.role === 'agent') {
    const agent = await prisma.agent.findUnique({ where: { userId: user.id }, select: { id: true } });
    return agent?.id ?? null;
  }
  if (explicitAgentId) return explicitAgentId;
  if (user.agencyId) {
    const agent = await prisma.agent.findFirst({
      where: { agencyId: user.agencyId, status: 'active', isDeleted: false },
      select: { id: true },
      orderBy: { joinedAt: 'asc' },
    });
    return agent?.id ?? null;
  }
  return null;
}
