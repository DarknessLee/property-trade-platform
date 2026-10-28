import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('dicts')
export class DictsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(@Query('category') category?: string): Promise<Array<{ id: string; category: string; key: string; label: string; value: string | null; sortOrder: number }>> {
    const rows = await this.prisma.dataDict.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, category: r.category, key: r.key, label: r.label, value: r.value, sortOrder: r.sortOrder }));
  }

  @Public()
  @Get('grouped')
  async grouped(): Promise<Record<string, Array<{ key: string; label: string; value: string | null }>>> {
    const rows = await this.prisma.dataDict.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
    const grouped: Record<string, Array<{ key: string; label: string; value: string | null }>> = {};
    for (const row of rows) {
      grouped[row.category] = grouped[row.category] ?? [];
      grouped[row.category].push({ key: row.key, label: row.label, value: row.value });
    }
    return grouped;
  }
}
