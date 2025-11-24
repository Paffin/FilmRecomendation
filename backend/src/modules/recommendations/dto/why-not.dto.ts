import { IsOptional, IsString, IsUUID } from 'class-validator';

export class WhyNotDto {
  @IsString()
  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsString()
  titleId?: string;
}
