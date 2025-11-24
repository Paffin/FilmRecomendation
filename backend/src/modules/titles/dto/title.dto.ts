import type { MediaType } from '@prisma/client';

export interface ApiTitleDto {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  originalTitle: string;
  russianTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  tmdbRating: number | null;
  genres: string[];
  countries: string[];
  originalLanguage: string;
}

