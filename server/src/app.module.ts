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

export const JWT_SECRET = process.env.JWT_SECRET ?? 'property-trade-platform-demo-secret-2026';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: '12h' },
    }),
    PrismaModule,
    AuthModule,
    DictsModule,
    NotificationsModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
