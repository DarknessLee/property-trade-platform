import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ListingsService } from './listings.service';
import { CreateListingDto, ListListingsQueryDto, UpdateListingDto, VerifyListingDto } from './dto';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin')
  list(@CurrentUser() user: AuthUser, @Query() query: ListListingsQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return this.listings.list(user, query);
  }

  @Get('duplicate-check')
  @Roles('agent', 'store_manager', 'admin')
  duplicateCheck(
    @CurrentUser() user: AuthUser,
    @Query('communityId') communityId?: string,
    @Query('area') area?: string,
    @Query('rooms') rooms?: string,
    @Query('excludeId') excludeId?: string,
  ): Promise<{ items: Array<{ id: string; code: string; title: string; area: number; totalPrice: number; status: string; agentName: string }> }> {
    return this.listings.duplicateCheck(user, { communityId, area, rooms, excludeId });
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'finance', 'admin')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.listings.detail(user, id);
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto): Promise<unknown> {
    return this.listings.create(user, dto);
  }

  @Patch(':id')
  @Roles('agent', 'store_manager', 'admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateListingDto): Promise<unknown> {
    return this.listings.update(user, id, dto);
  }

  @Post(':id/submit-verify')
  @Roles('agent', 'store_manager', 'admin')
  submitVerify(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.listings.submitVerify(user, id);
  }

  @Post(':id/publish')
  @Roles('agent', 'store_manager', 'admin')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.listings.publish(user, id);
  }

  @Post(':id/offline')
  @Roles('agent', 'store_manager', 'admin')
  offline(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.listings.offline(user, id);
  }

  @Post(':id/verify')
  @Roles('admin')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: VerifyListingDto): Promise<unknown> {
    return this.listings.verify(user, id, dto);
  }
}
