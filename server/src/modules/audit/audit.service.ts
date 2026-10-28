import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';

/** 操作日志（演示环境保留 50+ 条种子 + 新增业务操作留痕，供后台查询与审计演示） */
@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: Request & { user?: AuthUser },
  ) {}

  async record(action: string, targetType: string, targetId?: string | null, detail?: unknown): Promise<void> {
    try {
      const user = this.request.user;
      await this.prisma.operationLog.create({
        data: {
          userId: user?.id ?? null,
          action,
          targetType,
          targetId: targetId ?? null,
          detail: JSON.stringify(detail ?? {}),
          ip: this.request.ip ?? null,
        },
      });
    } catch (error) {
      // 审计失败不影响主流程
      this.logger.warn(`操作日志写入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
