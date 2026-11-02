import { Body, Controller, Get, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators';
import { ContractsService } from './contracts.service';
import { CreateContractDto, CreateTemplateDto, ListContractsQueryDto, SignContractDto, UpdateProgressDto, UpdateTemplateDto } from './dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get('templates')
  @Roles('agent', 'store_manager', 'finance', 'admin', 'buyer', 'seller')
  templates(): Promise<unknown[]> {
    return this.contracts.templates();
  }

  @Get('templates/all')
  @Roles('admin')
  templatesAdmin(): Promise<unknown[]> {
    return this.contracts.templatesAdmin();
  }

  @Post('templates')
  @Roles('admin')
  createTemplate(@CurrentUser() user: AuthUser, @Body() dto: CreateTemplateDto): Promise<unknown> {
    return this.contracts.createTemplate(user, dto);
  }

  @Patch('templates/:id')
  @Roles('admin')
  updateTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTemplateDto): Promise<unknown> {
    return this.contracts.updateTemplate(user, id, dto);
  }

  @Get()
  @Roles('agent', 'store_manager', 'finance', 'admin', 'buyer', 'seller')
  list(@CurrentUser() user: AuthUser, @Query() query: ListContractsQueryDto): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    return this.contracts.list(user, query);
  }

  @Get(':id/progress')
  @Roles('agent', 'store_manager', 'finance', 'admin', 'buyer', 'seller')
  progress(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown[]> {
    return this.contracts.progress(user, id);
  }

  @Get(':id/download')
  @Roles('agent', 'store_manager', 'finance', 'admin', 'buyer', 'seller')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<StreamableFile> {
    const { buffer, fileName } = await this.contracts.download(user, id);
    return new StreamableFile(Buffer.from(buffer), {
      type: 'application/pdf',
      disposition: `attachment; filename="contract.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
  }

  @Get(':id/full-flow')
  @Roles('agent', 'store_manager', 'finance', 'admin', 'buyer', 'seller')
  fullFlow(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.contracts.fullFlow(user, id);
  }

  @Get(':id')
  @Roles('agent', 'store_manager', 'finance', 'admin', 'buyer', 'seller')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.contracts.detail(user, id);
  }

  @Post()
  @Roles('agent', 'store_manager', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto): Promise<unknown> {
    return this.contracts.create(user, dto);
  }

  @Post(':id/sign')
  @Roles('agent', 'store_manager', 'admin', 'buyer', 'seller')
  sign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() _dto: SignContractDto): Promise<unknown> {
    return this.contracts.sign(user, id);
  }

  @Post(':id/void')
  @Roles('agent', 'store_manager', 'admin')
  voidContract(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.contracts.void(user, id);
  }
}

@Controller('progress')
export class ProgressController {
  constructor(private readonly contracts: ContractsService) {}

  @Patch(':id')
  @Roles('agent', 'store_manager', 'admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProgressDto): Promise<unknown> {
    return this.contracts.updateProgress(user, id, dto);
  }

  @Post(':id/notify')
  @Roles('agent', 'store_manager', 'admin')
  notify(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ sent: number }> {
    return this.contracts.notifyProgress(user, id);
  }
}
