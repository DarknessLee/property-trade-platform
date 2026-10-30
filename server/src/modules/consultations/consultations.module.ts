import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ConsultationsService } from './consultations.service';
import { CreateConsultationDto, ListConsultationQueryDto, ReplyConsultationDto } from './dto';

@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Post()
  @Roles('buyer', 'seller')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConsultationDto): Promise<unknown> {
    return this.consultations.create(user, dto);
  }

  @Get('my')
  @Roles('buyer', 'seller')
  myList(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.consultations.myList(user);
  }

  @Get('inbox')
  @Roles('agent', 'store_manager', 'admin')
  inbox(@CurrentUser() user: AuthUser, @Query() query: ListConsultationQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number; pendingCount: number }> {
    return this.consultations.inbox(user, query);
  }

  @Post(':id/reply')
  @Roles('agent', 'store_manager', 'admin')
  reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReplyConsultationDto): Promise<unknown> {
    return this.consultations.reply(user, id, dto);
  }
}

@Module({
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
