import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators';
import { CommunitiesService } from './communities.service';
import { CommunityQueryDto, CreateCommunityDto } from './dto';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Get()
  @Roles('agent', 'store_manager', 'admin')
  list(@Query() query: CommunityQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return this.communities.list(query);
  }

  @Get('options')
  @Roles('agent', 'store_manager', 'admin')
  options(): Promise<Array<{ id: string; name: string; district: string; businessArea: string }>> {
    return this.communities.options();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateCommunityDto): Promise<unknown> {
    return this.communities.create(dto);
  }
}
