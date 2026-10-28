import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from './constants';

export const IS_PUBLIC_KEY = 'isPublic';
/** 无需登录即可访问（C 端浏览类接口） */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** 限定角色（与 JwtAuthGuard 配合，后端兜底） */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  phone: string;
}

/** 取当前登录用户（由 JwtAuthGuard 注入 request.user） */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});
