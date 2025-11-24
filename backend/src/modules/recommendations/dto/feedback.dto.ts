import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RecommendationFeedbackDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  titleId!: string;

  @IsIn(['like', 'dislike'], { message: 'feedback must be like|dislike' })
  feedback!: 'like' | 'dislike';
}
