import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { contractScopeWhere } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import dayjs from 'dayjs';

export class CreateLoanDto {
  @IsString()
  @IsNotEmpty()
  contractId!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写贷款银行' })
  bankName!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写贷款产品' })
  productName!: string;

  @IsInt()
  @Min(10000)
  amount!: number;

  @IsInt()
  @Min(12)
  @Max(360)
  termMonths!: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  annualRate!: number;
}

export class ReviewLoanDto {
  @IsIn([true, false])
  pass!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class UpdateDocumentsDto {
  @IsString()
  name!: string;

  @IsIn(['pending', 'uploaded', 'verified'])
  status!: string;
}

export class CreateAppraisalDto {
  @IsString()
  @IsNotEmpty()
  contractId!: string;

  @IsOptional()
  @IsString()
  loanId?: string;

  @IsString()
  @IsNotEmpty({ message: '请填写评估机构' })
  institutionName!: string;

  @IsDateString({}, { message: '请选择评估上门时间' })
  appointmentAt!: string;
}

export class UpdateAppraisalDto {
  @IsOptional()
  @IsIn(['pending', 'visiting', 'reported'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  appraisedValue?: number;

  @IsOptional()
  @IsString()
  reportNo?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

const LOAN_INCLUDE = {
  contract: {
    select: {
      id: true,
      code: true,
      amount: true,
      commissionAmount: true,
      signStatus: true,
      signedAt: true,
      agencyId: true,
      listing: { select: { id: true, title: true, code: true, area: true, community: { select: { name: true, district: true } } } },
      buyerCustomer: { select: { id: true, name: true, phone: true } },
      sellerCustomer: { select: { id: true, name: true, phone: true } },
      agent: { include: { user: { select: { name: true } } } },
    },
  },
  appraisals: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class LoansService {
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
      this.prisma.loanApplication.findMany({ where, include: LOAN_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.loanApplication.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async detail(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const row = await this.prisma.loanApplication.findFirst({ where: { id, contract: { is: contractWhere } }, include: LOAN_INCLUDE });
    if (!row) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '贷款申请不存在或无权访问' });
    return this.toDto(row);
  }

  async create(user: AuthUser, dto: CreateLoanDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({ where: { AND: [contractWhere, { id: dto.contractId }] }, include: { listing: true } });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    if (contract.signStatus !== 'signed') {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅已签署合同可发起贷款申请' });
    }
    if (dto.amount > contract.amount) {
      throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '贷款金额不能超过合同金额' });
    }
    const existing = await this.prisma.loanApplication.findFirst({ where: { contractId: contract.id, status: { not: 'rejected' } } });
    if (existing) {
      throw new BadRequestException({ code: ERROR_CODES.CONFLICT, message: `该合同已有贷款申请（${existing.code}），请勿重复发起` });
    }
    const loan = await this.prisma.loanApplication.create({
      data: {
        code: await this.nextCode(),
        contractId: contract.id,
        bankName: dto.bankName,
        productName: dto.productName,
        amount: dto.amount,
        termMonths: dto.termMonths,
        annualRate: dto.annualRate,
        status: 'draft',
        documentsJson: JSON.stringify([
          { name: '身份证', status: 'pending' },
          { name: '收入证明', status: 'pending' },
          { name: '银行流水', status: 'pending' },
          { name: '征信授权书', status: 'pending' },
        ]),
      },
      include: LOAN_INCLUDE,
    });
    await this.audit.record('create_loan', 'loan', loan.id, { code: loan.code, amount: dto.amount });
    return this.toDto(loan);
  }

  async submit(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const loan = await this.prisma.loanApplication.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!loan) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '贷款申请不存在' });
    if (loan.status !== 'draft') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅草稿状态可提交' });
    const updated = await this.prisma.loanApplication.update({ where: { id }, data: { status: 'submitted', submittedAt: new Date() }, include: LOAN_INCLUDE });
    await this.audit.record('submit_loan', 'loan', id, { code: loan.code });
    await this.notify(loan.contractId, '贷款申请已提交', `贷款申请 ${loan.code} 已提交银行预审（Mock）。`);
    return this.toDto(updated);
  }

  async review(user: AuthUser, id: string, dto: ReviewLoanDto) {
    if (!dto.pass && !dto.reason?.trim()) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '拒绝必须填写原因' });
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const loan = await this.prisma.loanApplication.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!loan) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '贷款申请不存在' });
    if (loan.status !== 'submitted') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅已提交状态可审批' });
    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { status: dto.pass ? 'approved' : 'rejected', approvedAt: dto.pass ? new Date() : null, rejectReason: dto.pass ? null : dto.reason },
      include: LOAN_INCLUDE,
    });
    await this.audit.record('review_loan', 'loan', id, { pass: dto.pass });
    await this.notify(loan.contractId, dto.pass ? '贷款已批贷' : '贷款被拒绝', dto.pass ? `贷款申请 ${loan.code} 已通过审批（Mock），可继续办理资金监管与过户。` : `贷款申请 ${loan.code} 被拒绝：${dto.reason}`);
    return this.toDto(updated);
  }

  async disburse(user: AuthUser, id: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const loan = await this.prisma.loanApplication.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!loan) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '贷款申请不存在' });
    if (loan.status !== 'approved') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '仅已批贷状态可放款' });
    const updated = await this.prisma.loanApplication.update({ where: { id }, data: { status: 'disbursed', disbursedAt: new Date() }, include: LOAN_INCLUDE });
    await this.audit.record('disburse_loan', 'loan', id, { code: loan.code });
    await this.notify(loan.contractId, '贷款已放款', `贷款 ${loan.code} 已放款（Mock），请核对资金监管账户入账。`);
    return this.toDto(updated);
  }

  async updateDocuments(user: AuthUser, id: string, dto: UpdateDocumentsDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const loan = await this.prisma.loanApplication.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!loan) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '贷款申请不存在' });
    let documents: Array<{ name: string; status: string }> = [];
    try {
      documents = JSON.parse(loan.documentsJson) as Array<{ name: string; status: string }>;
    } catch {
      documents = [];
    }
    const target = documents.find((item) => item.name === dto.name);
    if (!target) throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '材料不存在' });
    target.status = dto.status;
    const updated = await this.prisma.loanApplication.update({ where: { id }, data: { documentsJson: JSON.stringify(documents) }, include: LOAN_INCLUDE });
    return this.toDto(updated);
  }

  async createAppraisal(user: AuthUser, dto: CreateAppraisalDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({ where: { AND: [contractWhere, { id: dto.contractId }] } });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    const order = await this.prisma.appraisalOrder.create({
      data: {
        code: `PG${dayjs().format('YYYY')}${String((await this.prisma.appraisalOrder.count()) + 1).padStart(6, '0')}`,
        contractId: contract.id,
        loanId: dto.loanId ?? null,
        institutionName: dto.institutionName,
        appraiserName: '评估师·待分配',
        appointmentAt: new Date(dto.appointmentAt),
        status: 'pending',
        fee: 800,
      },
    });
    await this.audit.record('create_appraisal', 'appraisal', order.id, { code: order.code });
    return order;
  }

  async updateAppraisal(user: AuthUser, id: string, dto: UpdateAppraisalDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const order = await this.prisma.appraisalOrder.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!order) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '评估委托不存在' });
    if (dto.status === 'reported' && (!dto.appraisedValue || !dto.reportNo)) {
      throw new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message: '出报告需填写评估值与报告编号' });
    }
    const updated = await this.prisma.appraisalOrder.update({
      where: { id },
      data: {
        status: dto.status ?? order.status,
        appraisedValue: dto.appraisedValue ?? order.appraisedValue,
        reportNo: dto.reportNo ?? order.reportNo,
        remark: dto.remark ?? order.remark,
      },
    });
    await this.audit.record('update_appraisal', 'appraisal', id, { status: dto.status });
    return updated;
  }

  private async notify(contractId: string, title: string, content: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { buyerCustomer: true, sellerCustomer: true },
    });
    for (const target of [contract?.buyerCustomer.userId, contract?.sellerCustomer.userId]) {
      if (target) {
        await this.prisma.notification.create({ data: { userId: target, type: 'progress', title, content, bizType: 'contract', bizId: contractId } });
      }
    }
  }

  private async nextCode(): Promise<string> {
    const year = dayjs().format('YYYY');
    const last = await this.prisma.loanApplication.findFirst({ where: { code: { startsWith: `LOAN${year}` } }, orderBy: { code: 'desc' }, select: { code: true } });
    const seq = last ? Number(last.code.slice(8)) + 1 : 1;
    return `LOAN${year}${String(seq).padStart(6, '0')}`;
  }

  private toDto(row: {
    id: string;
    code: string;
    bankName: string;
    productName: string;
    amount: number;
    termMonths: number;
    annualRate: number;
    status: string;
    documentsJson: string;
    rejectReason: string | null;
    submittedAt: Date | null;
    approvedAt: Date | null;
    disbursedAt: Date | null;
    createdAt: Date;
    contract: unknown;
    appraisals: unknown[];
  }): Record<string, unknown> {
    let documents: unknown[] = [];
    try {
      documents = JSON.parse(row.documentsJson) as unknown[];
    } catch {
      documents = [];
    }
    return {
      id: row.id,
      code: row.code,
      bankName: row.bankName,
      productName: row.productName,
      amount: row.amount,
      termMonths: row.termMonths,
      annualRate: row.annualRate,
      status: row.status,
      documents,
      rejectReason: row.rejectReason,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      disbursedAt: row.disbursedAt,
      createdAt: row.createdAt,
      contract: row.contract,
      appraisals: row.appraisals,
    };
  }
}

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.loans.list(user, { status, page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.loans.detail(user, id);
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLoanDto) {
    return this.loans.create(user, dto);
  }

  @Post(':id/submit')
  @Roles('agent', 'store_manager', 'admin')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.loans.submit(user, id);
  }

  @Post(':id/review')
  @Roles('store_manager', 'admin')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewLoanDto) {
    return this.loans.review(user, id, dto);
  }

  @Post(':id/disburse')
  @Roles('store_manager', 'finance', 'admin')
  disburse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.loans.disburse(user, id);
  }

  @Patch(':id/documents')
  @Roles('agent', 'store_manager', 'admin')
  updateDocuments(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDocumentsDto) {
    return this.loans.updateDocuments(user, id, dto);
  }
}

@Controller('appraisals')
export class AppraisalsController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppraisalDto) {
    return this.loans.createAppraisal(user, dto);
  }

  @Patch(':id')
  @Roles('agent', 'store_manager', 'admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppraisalDto) {
    return this.loans.updateAppraisal(user, id, dto);
  }
}

@Module({
  controllers: [LoansController, AppraisalsController],
  providers: [LoansService],
})
export class LoansModule {}
