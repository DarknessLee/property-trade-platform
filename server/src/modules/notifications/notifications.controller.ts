import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() auth: AuthUser,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<{
    items: Array<{ id: string; type: string; title: string; content: string; isRead: boolean; createdAt: Date }>;
    unreadCount: number;
  }> {
    const where = { userId: auth.id, ...(unreadOnly === 'true' ? { isRead: false } : {}) };
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { userId: auth.id, isRead: false } }),
    ]);
    return {
      items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, content: n.content, isRead: n.isRead, createdAt: n.createdAt })),
      unreadCount,
    };
  }

  @Post('read-all')
  async readAll(@CurrentUser() auth: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({ where: { userId: auth.id, isRead: false }, data: { isRead: true } });
    return { updated: result.count };
  }

  @Post(':id/read')
  async read(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<{ ok: boolean }> {
    await this.prisma.notification.updateMany({ where: { id, userId: auth.id }, data: { isRead: true } });
    return { ok: true };
  }
}
