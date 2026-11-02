import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty({ message: '请填写模板名称' })
  @MaxLength(50)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写版本' })
  @MaxLength(20)
  version!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写模板正文' })
  content!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  version?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
