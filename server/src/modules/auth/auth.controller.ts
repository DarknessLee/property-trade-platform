import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ERROR_CODES, ROLE_LABELS, type Role } from '../../common/constants';
import { assertValidIdCard, maskIdCard } from '../../common/idcard';

export class LoginDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password!: string;
}

export class RealNameDto {
  @IsString()
  @IsNotEmpty({ message: '请填写真实姓名' })
  realName!: string;

  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号应为 18 位' })
  idCard!: string;
}

export class CodeLoginDto {
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })
  code!: string;
}

export interface SafeUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  roleLabel: string;
  email: string | null;
  avatar: string | null;
  realNameStatus: string | null;
  agencyId?: string | null;
  agencyName?: string | null;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<{ token: string; user: SafeUser }> {
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, isDeleted: false },
      include: { realNameAuth: true, agent: { include: { agency: true } } },
    });
    if (!user || user.status !== 'active' || !bcrypt.compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException({ code: ERROR_CODES.LOGIN_FAILED, message: '手机号或密码错误' });
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
    });

    return { token, user: this.toSafeUser(user) };
  }

  /** 验证码登录（Mock：演示环境固定验证码 123456，不发送真实短信） */
  @Public()
  @Post('login/code')
  async loginByCode(@Body() dto: CodeLoginDto): Promise<{ token: string; user: SafeUser }> {
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, isDeleted: false },
      include: { realNameAuth: true, agent: { include: { agency: true } } },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({ code: ERROR_CODES.LOGIN_FAILED, message: '手机号未注册' });
    }
    if (dto.code !== '123456') {
      throw new UnauthorizedException({ code: ERROR_CODES.LOGIN_FAILED, message: '验证码错误（演示环境固定为 123456）' });
    }
    const token = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
    });
    return { token, user: this.toSafeUser(user) };
  }

  @Get('me')
  async me(@CurrentUser() auth: AuthUser): Promise<SafeUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      include: { realNameAuth: true, agent: { include: { agency: true } } },
    });
    return this.toSafeUser(user);
  }

  @Post('realname')
  async submitRealName(@CurrentUser() auth: AuthUser, @Body() dto: RealNameDto): Promise<{ status: string }> {
    assertValidIdCard(dto.idCard);
    const idCardHash = createHash('sha256').update(dto.idCard.toUpperCase()).digest('hex');

    const dupe = await this.prisma.realNameAuth.findFirst({ where: { idCardHash, userId: { not: auth.id } } });
    if (dupe) {
      throw new UnauthorizedException({ code: ERROR_CODES.CONFLICT, message: '该证件号已被其他账号实名认证' });
    }

    await this.prisma.realNameAuth.upsert({
      where: { userId: auth.id },
      create: {
        userId: auth.id,
        realName: dto.realName,
        idCardMasked: maskIdCard(dto.idCard),
        idCardHash,
        status: 'pending',
      },
      update: {
        realName: dto.realName,
        idCardMasked: maskIdCard(dto.idCard),
        idCardHash,
        status: 'pending',
        rejectReason: null,
        submittedAt: new Date(),
        reviewedAt: null,
      },
    });
    return { status: 'pending' };
  }

  @Get('realname')
  async realName(@CurrentUser() auth: AuthUser): Promise<{ status: string | null; realName: string | null; idCardMasked: string | null }> {
    const record = await this.prisma.realNameAuth.findUnique({ where: { userId: auth.id } });
    return {
      status: record?.status ?? null,
      realName: record?.realName ?? null,
      idCardMasked: record?.idCardMasked ?? null,
    };
  }

  private toSafeUser(user: {
    id: string;
    phone: string;
    name: string;
    role: string;
    email: string | null;
    avatar: string | null;
    realNameAuth: { status: string } | null;
    agent: { agencyId: string; agency: { name: string } } | null;
  }): SafeUser {
    const role = user.role as Role;
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role,
      roleLabel: ROLE_LABELS[role] ?? role,
      email: user.email,
      avatar: user.avatar,
      realNameStatus: user.realNameAuth?.status ?? null,
      agencyId: user.agent?.agencyId ?? null,
      agencyName: user.agent?.agency.name ?? null,
    };
  }
}
