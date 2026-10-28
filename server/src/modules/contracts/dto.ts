import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContractDto {
  @IsString()
  listingId!: string;

  @IsString()
  buyerCustomerId!: string;

  @IsString()
  sellerCustomerId!: string;

  @IsString()
  templateId!: string;

  @IsOptional()
  @IsInt()
  @Min(100000)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.005)
  @Max(0.03)
  commissionRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositAmount?: number;
}

export class ListContractsQueryDto {
  @IsOptional()
  @IsIn(['draft', 'pending', 'signed', 'voided'])
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

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

export class UpdateProgressDto {
  @IsOptional()
  @IsIn(['todo', 'doing', 'done'])
  status?: string;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class SignContractDto {
  @IsOptional()
  @IsString()
  @Matches(/^(buyer|seller|agent)$/)
  signer?: string;
}
