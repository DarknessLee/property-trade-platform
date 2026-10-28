import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2, { message: '客户姓名至少 2 个字' })
  @MaxLength(20)
  name!: string;

  @Matches(/^1[3-9]\d{9}$/, { message: '客户手机号格式不正确' })
  phone!: string;

  @IsIn(['buyer', 'seller'])
  type!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  demand?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  level?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  demand?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  level?: string;

  @IsOptional()
  @IsIn(['following', 'signed', 'invalid'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class ProtectCustomerDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['buyer', 'seller'])
  type?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  level?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

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
