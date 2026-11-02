import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { HealthController } from './modules/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DictsModule } from './modules/dicts/dicts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PublicModule } from './modules/public/public.module';
import { AuditModule } from './modules/audit/audit.module';
import { ListingsModule } from './modules/listings/listings.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { OptionsModule } from './modules/options/options.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ShowingsModule } from './modules/showings/showings.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { AgenciesModule } from './modules/agencies/agencies.controller';
import { StatsModule } from './modules/stats/stats.controller';
import { AdminModule } from './modules/admin/admin.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { LoansModule } from './modules/loans/loans.module';
import { EscrowsModule } from './modules/escrows/escrows.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'property-trade-platform-demo-secret-2026';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: '12h' },
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    DictsModule,
    NotificationsModule,
    PublicModule,
    ListingsModule,
    CommunitiesModule,
    OptionsModule,
    AttachmentsModule,
    CustomersModule,
    ShowingsModule,
    ContractsModule,
    AgenciesModule,
    StatsModule,
    AdminModule,
    FinanceModule,
    ApprovalsModule,
    ConsultationsModule,
    LoansModule,
    EscrowsModule,
    TransfersModule,
    CommissionsModule,
    ComplaintsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
