import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { MediaType } from '@prisma/client';

@Injectable()
export class TitlesService {
  constructor(private readonly prisma: PrismaService, private readonly tmdb: TmdbService) {}

  async search(query: string, page = 1, mediaType?: MediaType) {
    const tmdbType = mediaType ? this.mapMediaType(mediaType) : 'multi';
    const results = await this.tmdb.search(query, page, tmdbType);
    // We return raw TMDB results; caching/save on demand when user interacts.
    return results;
  }

  async getOrCreateFromTmdb(tmdbId: number, mediaType: MediaType) {
    const existing = await this.prisma.title.findUnique({ where: { tmdbId } });
    if (existing) return existing;

    const details = await this.tmdb.details(tmdbId, this.mapMediaType(mediaType));
    if (!details) throw new NotFoundException('TMDB title not found');

    return this.prisma.title.create({
      data: {
        tmdbId,
        mediaType,
        imdbId: details.external_ids?.imdb_id ?? null,
        originalTitle: details.original_title || details.original_name,
        russianTitle: details.title || details.name,
        overview: details.overview ?? '',
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        releaseDate: details.release_date ? new Date(details.release_date) : details.first_air_date ? new Date(details.first_air_date) : null,
        runtime: details.runtime ?? (details.episode_run_time?.[0] ?? null),
        tmdbRating: details.vote_average ?? null,
        genres: (details.genres || []).map((g: any) => g.name),
        countries: (details.production_countries || []).map((c: any) => c.iso_3166_1),
        originalLanguage: details.original_language ?? 'unknown',
        rawTmdbJson: details,
      },
    });
  }

  async findOne(id: string) {
    const title = await this.prisma.title.findUnique({ where: { id } });
    if (!title) throw new NotFoundException('Title not found');
    return title;
  }

  async findSimilar(id: string, page = 1) {
    const title = await this.findOne(id);
    const similar = await this.tmdb.similar(title.tmdbId, this.mapMediaType(title.mediaType), page);
    return similar;
  }

  private mapMediaType(mediaType: MediaType): string {
    if (mediaType === 'movie') return 'movie';
    if (mediaType === 'tv') return 'tv';
    // anime/cartoon будем маппить в tv по умолчанию (TMDB не имеет отдельного типа)
    return 'tv';
  }
}
