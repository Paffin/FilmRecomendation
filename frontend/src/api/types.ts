export type MediaType = 'movie' | 'tv' | 'anime' | 'cartoon';

export type TitleStatus = 'planned' | 'watching' | 'watched' | 'dropped';

export type TitleSource = 'onboarding' | 'search' | 'recommendation' | 'manual';

export interface ApiTitle {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  originalTitle: string;
  russianTitle: string;
  overview: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  runtime?: number | null;
  tmdbRating?: number | null;
  genres: string[];
  countries: string[];
  originalLanguage: string;
}

export interface RecommendationUserState {
  status: TitleStatus | null;
  liked: boolean;
  disliked: boolean;
}

export interface RecommendationItemResponse {
  title: ApiTitle;
  explanation: string[];
  userState?: RecommendationUserState | null;
}

export interface RecommendationResponse {
  sessionId: string;
  items: RecommendationItemResponse[];
}

export interface UserTitleStateResponse {
  id: string;
  status: TitleStatus;
  liked: boolean;
  disliked: boolean;
  rating?: number | null;
  lastInteractionAt: string;
  title: ApiTitle;
}
