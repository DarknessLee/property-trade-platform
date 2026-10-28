import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateShowingDto {
  @IsString()
  listingId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsDateString({}, { message: '请选择预约时间' })
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMin?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateShowingDto {
  @IsOptional()
  @IsIn(['confirmed', 'done', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsDateString()
  actualAt?: string;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  rating?: string;
}

export class ListShowingsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'done', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  pageSize?: number;
}
