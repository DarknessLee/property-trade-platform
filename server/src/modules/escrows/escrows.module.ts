import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { contractScopeWhere } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import dayjs from 'dayjs';

export class CreateEscrowDto {
  @IsString()
  contractId!: string;

  @IsString()
  bankName!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalAmount?: number;
}

export class CreateEscrowTransactionDto {
  @IsIn(['deposit', 'release', 'transfer', 'refund'])
  type!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  nodeType?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

const ESCROW_INCLUDE = {
  contract: {
    select: {
      id: true,
      code: true,
      amount: true,
      signStatus: true,
      agencyId: true,
      listing: { select: { id: true, title: true, community: { select: { name: true, district: true } } } },
      buyerCustomer: { select: { name: true } },
      sellerCustomer: { select: { name: true } },
      agent: { include: { user: { select: { name: true } } } },
    },
  },
  transactions: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class EscrowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: { status?: string; page?: number; pageSize?: number }) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 10);
    const where = { ...(query.status ? { status: query.status } : {}), contract: { is: contractWhere } };
    const [rows, total] = await Promise.all([
      this.prisma.escrowAccount.findMany({ where, include: ESCROW_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.escrowAccount.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const row = await this.prisma.escrowAccount.findFirst({ where: { id, contract: { is: contractWhere } }, include: ESCROW_INCLUDE });
    if (!row) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '监管账户不存在或无权访问' });
    return this.toDto(row);
  }

  async overview(user: AuthUser) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const accounts = await this.prisma.escrowAccount.findMany({ where: { contract: { is: contractWhere } }, include: { transactions: true } });
    const total = accounts.reduce((sum, item) => sum + item.totalAmount, 0);
    const released = accounts.reduce((sum, item) => sum + item.releasedAmount, 0);
    const deposited = accounts.reduce(
      (sum, item) => sum + item.transactions.filter((t) => t.type === 'deposit').reduce((acc, t) => acc + t.amount, 0),
      0,
    );
    return { accountCount: accounts.length, totalAmount: total, depositedAmount: deposited, releasedAmount: released, activeCount: accounts.filter((a) => a.status === 'active').length };
  }

  async create(user: AuthUser, dto: CreateEscrowDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({ where: { AND: [contractWhere, { id: dto.contractId }] } });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    if (contract.signStatus !== 'signed') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅已签署合同可开立监管账户' });
    const existing = await this.prisma.escrowAccount.findUnique({ where: { contractId: contract.id } });
    if (existing) throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: `该合同已有监管账户（${existing.code}）` });
    const escrow = await this.prisma.escrowAccount.create({
      data: {
        code: `ESC${dayjs().format('YYYY')}${String((await this.prisma.escrowAccount.count()) + 1).padStart(6, '0')}`,
        contractId: contract.id,
        bankName: dto.bankName,
        accountNoMasked: `6222 **** **** ${String(Math.floor(Math.random() * 9000) + 1000)}`,
        agreementNo: `JGXY${dayjs().format('YYYY')}${String((await this.prisma.escrowAccount.count()) + 1).padStart(4, '0')}`,
        totalAmount: dto.totalAmount ?? contract.amount,
        status: 'active',
      },
      include: ESCROW_INCLUDE,
    });
    await this.audit.record('create_escrow', 'escrow', escrow.id, { code: escrow.code });
    return this.toDto(escrow);
  }

  async addTransaction(user: AuthUser, id: string, dto: CreateEscrowTransactionDto) {
    const escrow = await this.prisma.escrowAccount.findUnique({ where: { id } });
    if (!escrow) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '监管账户不存在' });
    if (dto.type === 'release' && escrow.releasedAmount + dto.amount > escrow.totalAmount) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '解冻金额超过监管总额' });
    }
    const tradeNo = `ESC${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 9000) + 1000}`;
    const [, updated] = await this.prisma.$transaction([
      this.prisma.escrowTransaction.create({
        data: { escrowId: id, type: dto.type, amount: dto.amount, nodeType: dto.nodeType ?? null, tradeNo, remark: dto.remark ?? null },
      }),
      this.prisma.escrowAccount.update({
        where: { id },
        data: {
          releasedAmount: dto.type === 'release' ? escrow.releasedAmount + dto.amount : escrow.releasedAmount,
          status: dto.type === 'release' && escrow.releasedAmount + dto.amount >= escrow.totalAmount ? 'released' : escrow.status,
        },
        include: ESCROW_INCLUDE,
      }),
    ]);
    await this.audit.record('escrow_transaction', 'escrow', id, { type: dto.type, amount: dto.amount });
    return this.toDto(updated);
  }

  private toDto(row: {
    id: string;
    code: string;
    bankName: string;
    accountNoMasked: string;
    agreementNo: string;
    totalAmount: number;
    releasedAmount: number;
    status: string;
    openedAt: Date;
    contract: unknown;
    transactions: unknown[];
  }): Record<string, unknown> {
    return {
      id: row.id,
      code: row.code,
      bankName: row.bankName,
      accountNoMasked: row.accountNoMasked,
      agreementNo: row.agreementNo,
      totalAmount: row.totalAmount,
      releasedAmount: row.releasedAmount,
      status: row.status,
      openedAt: row.openedAt,
      contract: row.contract,
      transactions: row.transactions,
    };
  }
}

@Controller('escrows')
export class EscrowsController {
  constructor(private readonly escrows: EscrowsService) {}

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.escrows.list(user, { status, page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Get('overview')
  @Roles('store_manager', 'finance', 'admin')
  overview(@CurrentUser() user: AuthUser) {
    return this.escrows.overview(user);
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrows.detail(user, id);
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEscrowDto) {
    return this.escrows.create(user, dto);
  }

  @Post(':id/transactions')
  @Roles('store_manager', 'finance', 'admin')
  addTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateEscrowTransactionDto) {
    return this.escrows.addTransaction(user, id, dto);
  }
}

@Module({
  controllers: [EscrowsController],
  providers: [EscrowsService],
})
export class EscrowsModule {}
