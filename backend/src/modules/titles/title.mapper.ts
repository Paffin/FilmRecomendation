import type { Title } from '@prisma/client';
import type { ApiTitleDto } from './dto/title.dto';

export const mapTitleToApi = (title: Title): ApiTitleDto => ({
  id: title.id,
  tmdbId: title.tmdbId,
  mediaType: title.mediaType,
  originalTitle: title.originalTitle,
  russianTitle: title.russianTitle,
  overview: title.overview,
  posterPath: title.posterPath ?? null,
  backdropPath: title.backdropPath ?? null,
  releaseDate: title.releaseDate ? title.releaseDate.toISOString() : null,
  runtime: title.runtime ?? null,
  tmdbRating: title.tmdbRating ?? null,
  genres: title.genres ?? [],
  countries: title.countries ?? [],
  originalLanguage: title.originalLanguage,
});

