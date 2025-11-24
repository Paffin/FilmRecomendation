import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaType, CatalogSnapshotKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { TitlesService } from '../titles/titles.service';

@Injectable()
export class RecommendationCatalogTasks {
  private readonly logger = new Logger(RecommendationCatalogTasks.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
    private readonly titlesService: TitlesService,
  ) {}

  // Обновляем витрину трендов/популярного раз в 6 часов, чтобы уменьшить
  // зависимость онлайновых рекомендаций от TMDB и ускорить ответы.
  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshCatalogSnapshots(): Promise<void> {
    const snapshotDate = new Date();
    const mediaTypes: MediaType[] = ['movie', 'tv'];

    for (const mediaType of mediaTypes) {
      await this.refreshKindForMediaType('trending', mediaType, snapshotDate);
      await this.refreshKindForMediaType('popular', mediaType, snapshotDate);
    }
  }

  private async refreshKindForMediaType(
    kind: CatalogSnapshotKind,
    mediaType: MediaType,
    snapshotDate: Date,
  ): Promise<void> {
    try {
      const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
      const response =
        kind === 'trending'
          ? await this.tmdb.trending(tmdbType)
          : await this.tmdb.popular(tmdbType);

      const results = (response?.results ?? []).slice(0, 40);
      if (!results.length) {
        this.logger.warn(`No ${kind} results for mediaType=${mediaType}`);
        return;
      }

      await this.prisma.catalogSnapshot.createMany({
        data: results.map((item: any) => ({
          tmdbId: item.id,
          mediaType,
          kind,
          score:
            typeof item.popularity === 'number'
              ? item.popularity
              : typeof item.vote_average === 'number'
                ? item.vote_average
                : null,
          snapshotDate,
        })),
      });

      await Promise.all(
        results.map((item: any) =>
          this.titlesService
            .getOrCreateFromTmdb(item.id, mediaType)
            .catch((error) =>
              this.logger.debug(
                `Skip snapshot title ${item.id} (${kind}/${mediaType}): ${String((error as Error).message)}`,
              ),
            ),
        ),
      );

      this.logger.log(
        `Refreshed ${kind} snapshot for mediaType=${mediaType}, size=${results.length}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to refresh ${kind} snapshot for mediaType=${mediaType}: ${String(
          (error as Error).message,
        )}`,
      );
    }
  }
}

