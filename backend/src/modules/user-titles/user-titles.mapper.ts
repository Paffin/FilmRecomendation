import type { Title, UserTitleState } from '@prisma/client';
import { mapTitleToApi } from '../titles/title.mapper';
import type { UserTitleStateResponseDto } from './dto/user-title-state-response.dto';

export const mapUserTitleStateToApi = (
  state: UserTitleState & { title: Title },
): UserTitleStateResponseDto => ({
  id: state.id,
  status: state.status,
  liked: state.liked,
  disliked: state.disliked,
  rating: state.rating ?? null,
  lastInteractionAt: state.lastInteractionAt.toISOString(),
  title: mapTitleToApi(state.title),
});
