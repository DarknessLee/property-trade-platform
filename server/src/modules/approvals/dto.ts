import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateApprovalConfigDto {
  @IsIn(['price_change', 'contract_void', 'key_handover'])
  type!: string;

  @IsIn(['single', 'two_level'])
  mode!: string;
}

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

export class CreateKeyHandoverDto {
  @IsString()
  @IsNotEmpty({ message: '请选择房源' })
  listingId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: '钥匙数量至少 1 把' })
  @Max(20)
  keyCount!: number;

  @IsString()
  @IsNotEmpty({ message: '请填写受托方' })
  @MaxLength(50)
  handoverTo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
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
