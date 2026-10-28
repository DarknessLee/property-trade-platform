import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ValidateNested,
} from 'class-validator';

export class ListingImageDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;
}

export class CreateListingDto {
  @IsString()
  @IsNotEmpty({ message: '请选择小区' })
  communityId!: string;

  @IsString()
  @IsNotEmpty({ message: '请选择业主' })
  ownerId!: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsString()
  @MinLength(4, { message: '房源标题至少 4 个字' })
  @MaxLength(60)
  title!: string;

  @IsNumber()
  @Min(20, { message: '建筑面积不能小于 20㎡' })
  area!: number;

  @IsInt()
  @Min(3000, { message: '单价过低，请填写 3000 元/㎡ 以上' })
  unitPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(100000)
  totalPrice?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  rooms!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  halls!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  bathrooms!: number;

  @IsIn(['南', '南北', '东南', '西南', '东', '西', '北', '东北', '西北'])
  orientation!: string;

  @IsInt()
  @Min(1)
  floor!: number;

  @IsInt()
  @Min(1)
  totalFloors!: number;

  @IsInt()
  @Min(1980)
  @Max(2030)
  buildYear!: number;

  @IsIn(['商品房', '房改房', '经济适用房', '公寓'])
  propertyType!: string;

  @IsIn(['毛坯', '简装', '精装', '豪装'])
  decoration!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images?: ListingImageDto[];

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  lat?: number;
}

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(20)
  area?: number;

  @IsOptional()
  @IsInt()
  @Min(3000)
  unitPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(100000)
  totalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['毛坯', '简装', '精装', '豪装'])
  decoration?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images?: ListingImageDto[];

  @IsOptional()
  @IsString()
  address?: string;
}

export class VerifyListingDto {
  @IsBoolean()
  pass!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class ListListingsQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  verifyStatus?: string;

  @IsOptional()
  @IsString()
  district?: string;

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
