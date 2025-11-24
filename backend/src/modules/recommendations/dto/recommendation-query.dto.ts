import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecommendationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number = 5;

  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsString()
  mindset?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  timeAvailable?: string;

  @IsOptional()
  @IsString()
  noveltyBias?: 'safe' | 'mix' | 'surprise';

  @IsOptional()
  @IsString()
  pace?: 'calm' | 'balanced' | 'dynamic';

  @IsOptional()
  @IsString()
  freshness?: 'trending' | 'classic' | 'any';
}
