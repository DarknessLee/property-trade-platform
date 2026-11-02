import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { CustomersService } from './customers.service';
import { AddFollowUpDto, CreateCustomerDto, ListCustomersQueryDto, ProtectCustomerDto, UpdateCustomerDto } from './dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles('agent', 'store_manager', 'admin')
  list(@CurrentUser() user: AuthUser, @Query() query: ListCustomersQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return this.customers.list(user, query);
  }

  @Get('options')
  @Roles('agent', 'store_manager', 'admin')
  options(@CurrentUser() user: AuthUser): Promise<Array<{ id: string; name: string; phone: string; type: string; level: string }>> {
    return this.customers.options(user);
  }

  @Get(':id/follow-ups')
  @Roles('agent', 'store_manager', 'admin')
  followUps(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown[]> {
    return this.customers.followUps(user, id);
  }

  @Post(':id/follow-ups')
  @Roles('agent', 'store_manager', 'admin')
  addFollowUp(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddFollowUpDto): Promise<unknown> {
    return this.customers.addFollowUp(user, id, dto);
  }

  @Get(':id/matches')
  @Roles('agent', 'store_manager', 'admin')
  matches(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Array<Record<string, unknown>>> {
    return this.customers.matches(user, id);
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.customers.detail(user, id);
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto): Promise<unknown> {
    return this.customers.create(user, dto);
  }

  @Patch(':id')
  @Roles('agent', 'store_manager', 'admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto): Promise<unknown> {
    return this.customers.update(user, id, dto);
  }

  @Post(':id/protect')
  @Roles('agent', 'store_manager', 'admin')
  protect(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProtectCustomerDto): Promise<unknown> {
    return this.customers.protect(user, id, dto);
  }
}
