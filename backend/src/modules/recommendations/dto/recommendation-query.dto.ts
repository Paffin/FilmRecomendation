import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecommendationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
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
}
