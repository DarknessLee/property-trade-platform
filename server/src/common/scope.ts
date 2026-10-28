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
