import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RecommendationFeedbackDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  titleId!: string;

  @IsIn(['like', 'dislike', 'watched'], {
    message: 'feedback must be like|dislike|watched',
  })
  feedback!: 'like' | 'dislike' | 'watched';
}
