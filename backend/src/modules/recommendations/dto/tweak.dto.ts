import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecommendationTweakDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  titleId!: string;

  @IsOptional()
  @IsIn(['shorter', 'longer'])
  runtime?: 'shorter' | 'longer';

  @IsOptional()
  @IsIn(['lighter', 'heavier'])
  tone?: 'lighter' | 'heavier';
}

