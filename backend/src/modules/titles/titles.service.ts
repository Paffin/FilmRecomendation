import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { MediaType } from '@prisma/client';

@Injectable()
export class TitlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
  ) {}

  /**
   * Lightweight discovery endpoint for onboarding.
   * Returns trending / popular titles by media type without persisting them.
   */
  async discover(page = 1, mediaType?: MediaType) {
    // If mediaType is not specified, use "all" to get a diverse mix.
    const tmdbType = mediaType ? this.mapMediaType(mediaType) : 'all';
    // Prefer trending as it reflects свежие и живые рекомендации.
    const trending = await this.tmdb.trending(tmdbType, 'week', page);
    // Fallback to popular if for some reason TMDB does not return results.
    if (trending?.results?.length) return trending;
    const fallbackType = mediaType ? this.mapMediaType(mediaType) : 'movie';
    return this.tmdb.popular(fallbackType, page);
  }

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
        releaseDate: details.release_date
          ? new Date(details.release_date)
          : details.first_air_date
            ? new Date(details.first_air_date)
            : null,
        runtime: details.runtime ?? details.episode_run_time?.[0] ?? null,
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

  async getTrailerForTitle(id: string) {
    const title = await this.findOne(id);
    const mediaType = this.mapMediaType(title.mediaType);
    const videos = await this.tmdb.videos(title.tmdbId, mediaType);

    const results: any[] = videos?.results ?? [];
    if (!results.length) {
      return null;
    }

    const isTrailer = (v: any) => v.type === 'Trailer';
    const isYoutube = (v: any) => v.site === 'YouTube';
    const isRussian = (v: any) => v.iso_639_1 === 'ru' || v.name?.toLowerCase().includes('рус');

    const pick = (predicate: (v: any) => boolean) =>
      results.find((v) => isTrailer(v) && isYoutube(v) && predicate(v));

    const ruTrailer = pick(isRussian);
    const anyTrailer = pick(() => true);
    const candidate = ruTrailer ?? anyTrailer;

    if (!candidate) {
      return null;
    }

    return {
      youtubeKey: candidate.key,
      name: candidate.name as string,
    };
  }

  private mapMediaType(mediaType: MediaType): string {
    if (mediaType === 'movie') return 'movie';
    if (mediaType === 'tv') return 'tv';
    // anime/cartoon будем маппить в tv по умолчанию (TMDB не имеет отдельного типа)
    return 'tv';
  }
}
