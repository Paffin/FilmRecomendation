import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MediaType, TitleStatus, TitleSource } from '@prisma/client';

export class CreateUserTitleDto {
  @IsInt()
  tmdbId!: number;

  @IsEnum(MediaType)
  mediaType!: MediaType;

  @IsEnum(TitleStatus)
  status!: TitleStatus;

  @IsEnum(TitleSource)
  @IsOptional()
  source?: TitleSource = 'manual';

  @IsBoolean()
  @IsOptional()
  liked?: boolean;

  @IsBoolean()
  @IsOptional()
  disliked?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;
}
