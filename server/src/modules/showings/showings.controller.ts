import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ShowingsService } from './showings.service';
import { CreateShowingDto, ListShowingsQueryDto, UpdateShowingDto } from './dto';

@Controller('showings')
export class ShowingsController {
  constructor(private readonly showings: ShowingsService) {}

  @Get()
  @Roles('agent', 'store_manager', 'admin')
  list(@CurrentUser() user: AuthUser, @Query() query: ListShowingsQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return this.showings.list(user, query);
  }

  @Get('calendar')
  @Roles('agent', 'store_manager', 'admin')
  calendar(@CurrentUser() user: AuthUser, @Query('weekStart') weekStart?: string): Promise<{ weekStart: string; days: Array<{ date: string; items: unknown[] }> }> {
    return this.showings.calendar(user, weekStart);
  }

  /** C 端：我的带看（声明在 :id 之前；预约仅对买方开放） */
  @Get('my')
  @Roles('buyer')
  myList(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.showings.myList(user);
  }

  @Post('my')
  @Roles('buyer')
  myCreate(@CurrentUser() user: AuthUser, @Body() dto: CreateShowingDto): Promise<unknown> {
    return this.showings.myCreate(user, dto);
  }

  @Patch('my/:id/cancel')
  @Roles('buyer')
  myCancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.showings.myCancel(user, id);
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShowingDto): Promise<unknown> {
    return this.showings.create(user, dto);
  }

  @Patch(':id')
  @Roles('agent', 'store_manager', 'admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateShowingDto): Promise<unknown> {
    return this.showings.update(user, id, dto);
  }
}
