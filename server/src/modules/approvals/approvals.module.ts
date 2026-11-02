import { Body, Controller, Get, Module, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ApprovalsService } from './approvals.service';
import { CreateKeyHandoverDto, CreatePriceApprovalDto, ListApprovalQueryDto, ReviewApprovalDto, UpdateApprovalConfigDto } from './dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @Roles('agent', 'store_manager', 'admin')
  list(@CurrentUser() user: AuthUser, @Query() query: ListApprovalQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return this.approvals.list(user, query);
  }

  @Get('config')
  @Roles('agent', 'store_manager', 'admin')
  getConfigs(): Promise<unknown[]> {
    return this.approvals.getConfigs();
  }

  @Put('config')
  @Roles('admin')
  updateConfig(@Body() dto: UpdateApprovalConfigDto): Promise<unknown> {
    return this.approvals.updateConfig(dto.type, dto.mode);
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.approvals.detail(user, id);
  }

  @Post('price-change')
  @Roles('agent', 'store_manager', 'admin')
  createPriceChange(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceApprovalDto): Promise<unknown> {
    return this.approvals.createPriceChange(user, dto);
  }

  @Post('key-handover')
  @Roles('agent', 'store_manager', 'admin')
  createKeyHandover(@CurrentUser() user: AuthUser, @Body() dto: CreateKeyHandoverDto): Promise<unknown> {
    return this.approvals.createKeyHandover(user, dto);
  }

  @Post(':id/approve')
  @Roles('store_manager', 'admin')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewApprovalDto): Promise<unknown> {
    return this.approvals.approve(user, id, dto);
  }

  @Post(':id/reject')
  @Roles('store_manager', 'admin')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewApprovalDto): Promise<unknown> {
    return this.approvals.reject(user, id, dto);
  }
}

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
