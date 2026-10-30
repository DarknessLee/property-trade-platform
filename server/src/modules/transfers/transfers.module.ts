import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ERROR_CODES } from '../../common/constants';
import { contractScopeWhere } from '../../common/scope';
import { AuditService } from '../audit/audit.service';
import dayjs from 'dayjs';

export class CreateAppointmentDto {
  @IsIn(['tax', 'transfer'])
  type!: string;

  @IsDateString({}, { message: '请选择预约时间' })
  appointmentAt!: string;

  @IsString()
  @IsNotEmpty()
  hallName!: string;
}

export class UpdateAppointmentDto {
  @IsIn(['booked', 'done', 'cancelled'])
  status!: string;
}

export class RegistrationActionDto {
  @IsIn(['submit', 'accept', 'register', 'complete'])
  action!: string;
}

export class VerifyMaterialDto {
  @IsIn(['uploaded', 'verified'])
  status!: string;
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: { page?: number; pageSize?: number }) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const page = query.page ?? 1;
    const pageSize = Math.min(60, query.pageSize ?? 10);
    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where: { AND: [contractWhere, { signStatus: 'signed' }] },
        include: {
          listing: { select: { title: true, community: { select: { name: true, district: true } } } },
          materials: true,
          taxes: true,
          appointments: true,
          registration: true,
        },
        orderBy: { signedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contract.count({ where: { AND: [contractWhere, { signStatus: 'signed' }] } }),
    ]);
    return {
      items: contracts.map((contract) => ({
        contractId: contract.id,
        code: contract.code,
        listing: contract.listing,
        signedAt: contract.signedAt,
        materialTotal: contract.materials.length,
        materialVerified: contract.materials.filter((item) => item.status === 'verified').length,
        taxTotal: contract.taxes.length,
        taxPaid: contract.taxes.filter((item) => item.status === 'paid').length,
        appointmentDone: contract.appointments.filter((item) => item.status === 'done').length,
        appointmentTotal: contract.appointments.length,
        registrationStatus: contract.registration?.status ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(user: AuthUser, contractId: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({
      where: { AND: [contractWhere, { id: contractId }] },
      include: {
        listing: { select: { id: true, title: true, code: true, community: { select: { name: true, district: true } } } },
        buyerCustomer: { select: { name: true, phone: true } },
        sellerCustomer: { select: { name: true, phone: true } },
        materials: { orderBy: { createdAt: 'asc' } },
        taxes: true,
        appointments: { orderBy: { appointmentAt: 'asc' } },
        registration: true,
      },
    });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    return {
      contract: {
        id: contract.id,
        code: contract.code,
        amount: contract.amount,
        signedAt: contract.signedAt,
        listing: contract.listing,
        buyer: contract.buyerCustomer,
        seller: contract.sellerCustomer,
      },
      materials: contract.materials,
      taxes: contract.taxes,
      appointments: contract.appointments,
      registration: contract.registration,
    };
  }

  async verifyMaterial(user: AuthUser, contractId: string, materialId: string, dto: VerifyMaterialDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const material = await this.prisma.materialChecklist.findFirst({ where: { id: materialId, contractId, contract: { is: contractWhere } } });
    if (!material) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '材料不存在或无权访问' });
    const updated = await this.prisma.materialChecklist.update({ where: { id: materialId }, data: { status: dto.status } });
    await this.audit.record('verify_material', 'material', materialId, { status: dto.status });
    return updated;
  }

  async payTax(user: AuthUser, contractId: string, taxId: string) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const tax = await this.prisma.taxRecord.findFirst({ where: { id: taxId, contractId, contract: { is: contractWhere } } });
    if (!tax) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '税费记录不存在或无权访问' });
    if (tax.status === 'paid') throw new BadRequestException({ code: ERROR_CODES.BUSINESS_RULE, message: '该税费已缴纳' });
    const updated = await this.prisma.taxRecord.update({
      where: { id: taxId },
      data: { status: 'paid', receiptNo: `WS${dayjs().format('YYYY')}${String((await this.prisma.taxRecord.count()) + 1).padStart(6, '0')}`, paidAt: new Date() },
    });
    await this.audit.record('pay_tax', 'tax', taxId, { amount: tax.amount });
    return updated;
  }

  async createAppointment(user: AuthUser, contractId: string, dto: CreateAppointmentDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({ where: { AND: [contractWhere, { id: contractId }] } });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    const appointment = await this.prisma.transferAppointment.create({
      data: {
        code: `YY${dayjs().format('YYYY')}${String((await this.prisma.transferAppointment.count()) + 1).padStart(6, '0')}`,
        contractId,
        type: dto.type,
        appointmentAt: new Date(dto.appointmentAt),
        hallName: dto.hallName,
        appointmentNo: `YY${dayjs().format('YYYYMMDD')}${String((await this.prisma.transferAppointment.count()) + 1).padStart(4, '0')}`,
        status: 'booked',
      },
    });
    await this.audit.record('create_appointment', 'appointment', appointment.id, { type: dto.type });
    return appointment;
  }

  async updateAppointment(user: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const appointment = await this.prisma.transferAppointment.findFirst({ where: { id, contract: { is: contractWhere } } });
    if (!appointment) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '预约不存在或无权访问' });
    const updated = await this.prisma.transferAppointment.update({ where: { id }, data: { status: dto.status } });
    await this.audit.record('update_appointment', 'appointment', id, { status: dto.status });
    return updated;
  }

  async registrationAction(user: AuthUser, contractId: string, dto: RegistrationActionDto) {
    const contractWhere = await contractScopeWhere(this.prisma, user);
    const contract = await this.prisma.contract.findFirst({ where: { AND: [contractWhere, { id: contractId }] } });
    if (!contract) throw new BadRequestException({ code: ERROR_CODES.NOT_FOUND, message: '合同不存在或无权访问' });
    const existing = await this.prisma.registrationApplication.findUnique({ where: { contractId } });
    const nextStatus = { submit: 'submitted', accept: 'accepted', register: 'registered', complete: 'completed' }[dto.action];
    const now = new Date();
    const data: Record<string, unknown> = { status: nextStatus };
    if (dto.action === 'accept') {
      data.acceptedAt = now;
      data.acceptNo = `SL${dayjs().format('YYYY')}${String((await this.prisma.registrationApplication.count()) + 1).padStart(6, '0')}`;
    }
    if (dto.action === 'register' || dto.action === 'complete') data.completedAt = now;
    const updated = existing
      ? await this.prisma.registrationApplication.update({ where: { contractId }, data })
      : await this.prisma.registrationApplication.create({
          data: {
            code: `REG${dayjs().format('YYYY')}${String((await this.prisma.registrationApplication.count()) + 1).padStart(6, '0')}`,
            contractId,
            ...data,
          },
        });
    await this.audit.record('registration_action', 'registration', updated.id, { action: dto.action });
    return updated;
  }
}

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin')
  list(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.transfers.list(user, { page: Number(page) || 1, pageSize: Number(pageSize) || 10 });
  }

  @Get(':contractId')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string) {
    return this.transfers.detail(user, contractId);
  }

  @Patch(':contractId/materials/:materialId')
  @Roles('agent', 'store_manager', 'admin')
  verifyMaterial(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string, @Param('materialId') materialId: string, @Body() dto: VerifyMaterialDto) {
    return this.transfers.verifyMaterial(user, contractId, materialId, dto);
  }

  @Post(':contractId/taxes/:taxId/pay')
  @Roles('store_manager', 'finance', 'admin')
  payTax(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string, @Param('taxId') taxId: string) {
    return this.transfers.payTax(user, contractId, taxId);
  }

  @Post(':contractId/appointments')
  @Roles('agent', 'store_manager', 'admin')
  createAppointment(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string, @Body() dto: CreateAppointmentDto) {
    return this.transfers.createAppointment(user, contractId, dto);
  }

  @Patch('appointments/:id')
  @Roles('agent', 'store_manager', 'admin')
  updateAppointment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.transfers.updateAppointment(user, id, dto);
  }

  @Post(':contractId/registration')
  @Roles('agent', 'store_manager', 'admin')
  registration(@CurrentUser() user: AuthUser, @Param('contractId') contractId: string, @Body() dto: RegistrationActionDto) {
    return this.transfers.registrationAction(user, contractId, dto);
  }
}

@Module({
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
