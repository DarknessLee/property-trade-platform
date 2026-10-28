import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty({ message: '请填写小区名称' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: '请选择区域' })
  district!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写商圈' })
  businessArea!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写小区地址' })
  address!: string;

  @IsInt()
  @Min(1980)
  @Max(2030)
  buildYear!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalBuildings?: number;

  @IsNumber()
  @Min(0.5)
  @Max(10)
  plotRatio!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  greenRate?: number;

  @IsNumber()
  @Min(0)
  @Max(50)
  propertyFee!: number;

  @IsNumber()
  lng!: number;

  @IsNumber()
  lat!: number;
}

export class CommunityQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
