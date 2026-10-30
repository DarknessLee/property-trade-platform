import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateConsultationDto {
  @IsString()
  @IsNotEmpty({ message: '请选择房源' })
  listingId!: string;

  @IsString()
  @MinLength(5, { message: '留言至少 5 个字' })
  @MaxLength(500)
  content!: string;
}

export class ReplyConsultationDto {
  @IsString()
  @MinLength(2, { message: '回复至少 2 个字' })
  @MaxLength(500)
  content!: string;
}

export class ListConsultationQueryDto {
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
