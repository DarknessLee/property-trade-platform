import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePriceApprovalDto {
  @IsString()
  @IsNotEmpty({ message: '请选择房源' })
  listingId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(100000, { message: '新总价不能低于 10 万元' })
  newTotalPrice!: number;

  @IsString()
  @IsNotEmpty({ message: '请填写调价原因' })
  @MaxLength(200)
  reason!: string;
}

export class ReviewApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  comment?: string;
}

export class ListApprovalQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
