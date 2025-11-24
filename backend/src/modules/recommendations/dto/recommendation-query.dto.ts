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

  @IsOptional()
  @IsString()
  diversityLevel?: 'soft' | 'balanced' | 'bold';

  @IsOptional()
  @IsString()
  timeOfDay?: 'morning' | 'day' | 'evening' | 'late_night';

  @IsOptional()
  @IsString()
  dayOfWeek?: 'weekday' | 'weekend';

  // Taste Mixer sliders (0–100)
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  mixerRisk?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  mixerNovelty?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  mixerTypeTilt?: number;

  // Live taste editor overrides (0.5–1.5 — множитель веса)
  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1.5)
  overrideGenre?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1.5)
  overrideMood?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1.5)
  overrideNovelty?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1.5)
  overrideDecade?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1.5)
  overrideCountry?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(1.5)
  overridePeople?: number;
}
