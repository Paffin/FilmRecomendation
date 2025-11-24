import type { TitleStatus } from '@prisma/client';
import type { ApiTitleDto } from '../../titles/dto/title.dto';

export interface UserTitleStateResponseDto {
  id: string;
  status: TitleStatus;
  liked: boolean;
  disliked: boolean;
  rating: number | null;
  lastInteractionAt: string;
  title: ApiTitleDto;
}

