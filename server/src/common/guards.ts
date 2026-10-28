import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ERROR_CODES, type Role } from './constants';
import { IS_PUBLIC_KEY, ROLES_KEY, type AuthUser } from './decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: '请先登录' });
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; role: Role; name: string; phone: string; agencyId?: string | null }>(token);
      request.user = { id: payload.sub, role: payload.role, name: payload.name, phone: payload.phone, agencyId: payload.agencyId ?? null };
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: '登录已过期，请重新登录' });
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!request.user) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: '请先登录' });
    }
    if (!required.includes(request.user.role)) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: `当前角色无权访问该功能（需要：${required.join('/')}）`,
      });
    }
    return true;
  }
}
