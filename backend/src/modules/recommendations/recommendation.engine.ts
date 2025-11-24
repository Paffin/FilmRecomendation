import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { MediaType, Title } from '@prisma/client';
import { TitlesService } from '../titles/titles.service';
import { TmdbService } from '../tmdb/tmdb.service';

export interface RecommendationContext {
  mood?: string;
  mindset?: string;
  company?: string;
  timeAvailable?: string;
}

export interface RecommendationResultItem {
  title: Title;
  score: number;
  signals: Record<string, number>;
  explanation: string[];
}

type Candidate = Title;

interface UserTasteProfile {
  genreWeights: Record<string, number>;
  countryWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  peopleWeights: Record<string, number>;
  preferredRuntime: number | null;
  seenTitleIds: Set<string>;
  likedTitleIds: Set<string>;
  dislikedTitleIds: Set<string>;
  preferredTypes: Set<MediaType>;
}

@Injectable()
export class RecommendationEngine {
  private readonly logger = new Logger(RecommendationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly titlesService: TitlesService,
    private readonly tmdb: TmdbService,
  ) {}

  async recommend(userId: string, limit: number, context: RecommendationContext): Promise<RecommendationResultItem[]> {
    const profile = await this.buildUserProfile(userId);
    const candidates = await this.buildCandidatePool(userId, profile, limit * 6);

    const scored = candidates
      .filter((c) => !profile.dislikedTitleIds.has(c.id))
      .map((title) => this.scoreCandidate(title, profile, context))
      .sort((a, b) => b.score - a.score);

    const diversified = this.diversify(scored, limit);
    return diversified.map((item) => ({
      title: item.title,
      score: item.score,
      signals: item.signals,
      explanation: this.buildExplanation(item),
    }));
  }

  private async buildUserProfile(userId: string): Promise<UserTasteProfile> {
    const states = await this.prisma.userTitleState.findMany({
      where: { userId },
      include: { title: true },
    });

    const genreWeights: Record<string, number> = {};
    const countryWeights: Record<string, number> = {};
    const decadeWeights: Record<string, number> = {};
    const peopleWeights: Record<string, number> = {};
    let runtimeSum = 0;
    let runtimeCount = 0;

    const likedTitleIds = new Set<string>();
    const dislikedTitleIds = new Set<string>();
    const seenTitleIds = new Set<string>();
    const preferredTypes = new Set<MediaType>();

    states.forEach((state) => {
      const { title } = state;
      if (state.liked) likedTitleIds.add(title.id);
      if (state.disliked || state.status === 'dropped') dislikedTitleIds.add(title.id);
      seenTitleIds.add(title.id);
      preferredTypes.add(title.mediaType);

      const weight = state.liked ? 2 : state.disliked ? -2 : state.status === 'watched' ? 1 : 0.5;

      title.genres?.forEach((g) => {
        genreWeights[g] = (genreWeights[g] ?? 0) + weight;
      });

      title.countries?.forEach((c) => {
        countryWeights[c] = (countryWeights[c] ?? 0) + weight * 0.7;
      });

      const year = title.releaseDate?.getFullYear();
      if (year) {
        const decade = Math.floor(year / 10) * 10;
        decadeWeights[String(decade)] = (decadeWeights[String(decade)] ?? 0) + weight * 0.8;
      }

      const { mainPeople } = this.extractPeople(title);
      mainPeople.forEach((p) => {
        peopleWeights[p] = (peopleWeights[p] ?? 0) + weight * 0.6;
      });

      if (title.runtime) {
        runtimeSum += title.runtime;
        runtimeCount += 1;
      }
    });

    return {
      genreWeights,
      countryWeights,
      decadeWeights,
      peopleWeights,
      preferredRuntime: runtimeCount ? runtimeSum / runtimeCount : null,
      likedTitleIds,
      dislikedTitleIds,
      seenTitleIds,
      preferredTypes,
    };
  }

  private async buildCandidatePool(userId: string, profile: UserTasteProfile, targetSize: number): Promise<Candidate[]> {
    const candidates: Candidate[] = [];
    const seenTmdbIds = new Set<number>();

    const recentLikes = await this.prisma.userTitleState.findMany({
      where: { userId, liked: true },
      include: { title: true },
      orderBy: { lastInteractionAt: 'desc' },
      take: 5,
    });

    // Похожие к любимым тайтлам
    for (const state of recentLikes) {
      const media = this.mapMediaType(state.title.mediaType);
      const similar = await this.tmdb.similar(state.title.tmdbId, media);
      for (const item of similar?.results?.slice(0, 6) ?? []) {
        const title = await this.safeGetOrCreate(item.id, state.title.mediaType);
        if (title && !seenTmdbIds.has(title.tmdbId) && !profile.seenTitleIds.has(title.id)) {
          candidates.push(title);
          seenTmdbIds.add(title.tmdbId);
        }
      }
    }

    // Тренды по любимым типам или по умолчанию movie+tv
    const mediaTypes = profile.preferredTypes.size > 0 ? Array.from(profile.preferredTypes) : ['movie', 'tv'];
    for (const mt of mediaTypes) {
      const trend = await this.tmdb.trending(this.mapMediaType(mt));
      for (const item of trend?.results?.slice(0, 12) ?? []) {
        const resolvedType = this.normalizeMediaType(item.media_type) ?? (mt as MediaType);
        const title = await this.safeGetOrCreate(item.id, resolvedType);
        if (title && !seenTmdbIds.has(title.tmdbId) && !profile.seenTitleIds.has(title.id)) {
          candidates.push(title);
          seenTmdbIds.add(title.tmdbId);
        }
      }
    }

    // Локальные тайтлы, которые пользователь ещё не видел
    const local = await this.prisma.title.findMany({
      where: { id: { notIn: Array.from(profile.seenTitleIds) } },
      orderBy: { updatedAt: 'desc' },
      take: targetSize,
    });
    local.forEach((title) => {
      if (!seenTmdbIds.has(title.tmdbId)) {
        candidates.push(title);
        seenTmdbIds.add(title.tmdbId);
      }
    });

    return candidates.slice(0, targetSize);
  }

  private scoreCandidate(title: Title, profile: UserTasteProfile, context: RecommendationContext) {
    const signals: Record<string, number> = {};
    let score = 0;

    // Популярность/рейтинг
    const tmdbRating = title.tmdbRating ?? 6;
    const popularity = (title.rawTmdbJson as any)?.popularity ?? tmdbRating * 10;
    const popularityScore = Math.min(1, popularity / 500);
    signals.popularity = popularityScore;
    score += popularityScore * 0.25;

    // Жанры
    let genreScore = 0;
    title.genres?.forEach((g) => {
      const weight = profile.genreWeights[g] ?? 0;
      signals[`genre:${g}`] = weight;
      genreScore += weight;
    });
    score += genreScore * 0.15;

    // Страны
    let countryScore = 0;
    title.countries?.forEach((c) => {
      const w = profile.countryWeights[c] ?? 0;
      signals[`country:${c}`] = w;
      countryScore += w;
    });
    score += countryScore * 0.08;

    // Годы/десятилетия
    const year = title.releaseDate?.getFullYear();
    if (year) {
      const decade = Math.floor(year / 10) * 10;
      const decadeWeight = profile.decadeWeights[String(decade)] ?? 0;
      signals[`decade:${decade}`] = decadeWeight;
      score += decadeWeight * 0.08;
      signals.yearFreshness = Math.max(0, (2025 - year) / 40);
    }

    // Люди (режиссёры/актеры)
    const { mainPeople } = this.extractPeople(title);
    let peopleScore = 0;
    mainPeople.forEach((p) => {
      const w = profile.peopleWeights[p] ?? 0;
      signals[`person:${p}`] = w;
      peopleScore += w;
    });
    score += peopleScore * 0.12;

    // Runtime + контекст «время есть»
    if (title.runtime && context.timeAvailable) {
      const target = Number(context.timeAvailable);
      const diff = Math.abs(title.runtime - target);
      const runtimeScore = Math.max(0, 1 - diff / Math.max(target, 120));
      signals.runtimeFit = runtimeScore;
      score += runtimeScore * 0.12;
    } else if (title.runtime && profile.preferredRuntime) {
      const diff = Math.abs(title.runtime - profile.preferredRuntime);
      const runtimeScore = Math.max(0, 1 - diff / profile.preferredRuntime);
      signals.runtimeFit = runtimeScore;
      score += runtimeScore * 0.1;
    }

    // Настроение и образ мыслей
    const moodBoost = this.mapMoodBoost(context.mood, title.genres ?? []);
    if (moodBoost) {
      signals.mood = moodBoost;
      score += moodBoost * 0.1;
    }

    const mindsetBoost = this.mapMindsetBoost(context.mindset, tmdbRating);
    signals.mindset = mindsetBoost;
    score += mindsetBoost * 0.05;

    // Компания (семья/друзья)
    const companyPenalty = this.companyPenalty(context.company, title.rawTmdbJson as any);
    signals.companyPenalty = companyPenalty;
    score += companyPenalty * 0.05;

    // Новизна
    const novelty = profile.seenTitleIds.has(title.id) ? -0.6 : 0.2;
    signals.novelty = novelty;
    score += novelty * 0.08;

    // Диверсификация внутри выдачи добавляется в diversify()

    return { title, score, signals };
  }

  private diversify(items: { title: Title; score: number; signals: Record<string, number> }[], limit: number) {
    const picked: typeof items = [];
    const usedGenres = new Set<string>();

    for (const item of items) {
      if (picked.length >= limit) break;
      const overlap = (item.title.genres ?? []).some((g) => usedGenres.has(g));
      if (overlap && picked.length >= 2) continue;
      picked.push(item);
      item.title.genres?.forEach((g) => usedGenres.add(g));
    }

    if (picked.length < limit) {
      picked.push(...items.slice(picked.length, limit));
    }
    return picked.slice(0, limit);
  }

  private buildExplanation(item: { title: Title; score: number; signals: Record<string, number> }) {
    const { signals, title } = item;
    const entries = Object.entries(signals).filter(([, v]) => v > 0.05);
    entries.sort((a, b) => b[1] - a[1]);

    const reasons: string[] = [];
    for (const [key, value] of entries.slice(0, 4)) {
      if (key.startsWith('genre:')) {
        reasons.push(`Вам заходят жанры «${key.replace('genre:', '')}» (вес ${value.toFixed(2)})`);
      } else if (key.startsWith('person:')) {
        reasons.push(`Вы любите работы с участием ${key.replace('person:', '')}`);
      } else if (key.startsWith('decade:')) {
        reasons.push(`Часто выбираете тайтлы ${key.replace('decade:', '')}-х`);
      } else if (key === 'runtimeFit') {
        reasons.push('Подходит под доступное время просмотра');
      } else if (key === 'mood') {
        reasons.push('Соответствует выбранному настроению сегодня');
      } else if (key === 'mindset') {
        reasons.push('Матчится с желанием «думать/расслабиться»');
      }
    }

    if (reasons.length === 0) {
      reasons.push('Популярный тайтл в вашей тематике');
      if (title.tmdbRating) reasons.push(`Высокий рейтинг TMDB ${title.tmdbRating.toFixed(1)}`);
    }

    return reasons.slice(0, 3);
  }

  private mapMoodBoost(mood: string | undefined, genres: string[]): number {
    if (!mood) return 0.05;
    const moodMap: Record<string, string[]> = {
      light: ['комедия', 'анимация', 'семейный', 'приключения'],
      neutral: ['драма', 'триллер'],
      heavy: ['триллер', 'криминал', 'драма', 'ужасы'],
    };
    const target = moodMap[mood] ?? [];
    if (target.length === 0) return 0.05;
    const overlap = genres.filter((g) => target.some((t) => g.toLowerCase().includes(t))).length;
    return Math.min(0.4, overlap * 0.12);
  }

  private mapMindsetBoost(mindset: string | undefined, rating: number): number {
    if (!mindset) return 0.05;
    if (mindset === 'focus') return Math.min(0.4, (rating - 6) / 4);
    if (mindset === 'relax') return 0.1;
    return 0.08;
  }

  private companyPenalty(company: string | undefined, raw: any): number {
    if (!company) return 0.05;
    const isAdult = raw?.adult === true;
    if (company === 'family' && isAdult) return -0.5;
    if (company === 'family') return 0.15;
    if (company === 'friends') return 0.1;
    return 0.05;
  }

  private extractPeople(title: Title) {
    const raw = (title.rawTmdbJson ?? {}) as any;
    const cast: string[] = raw?.credits?.cast?.slice(0, 5)?.map((c: any) => c.name)?.filter(Boolean) ?? [];
    const directors: string[] = raw?.credits?.crew?.filter((c: any) => c.job === 'Director')?.map((c: any) => c.name) ?? [];
    const writers: string[] = raw?.credits?.crew?.filter((c: any) => c.department === 'Writing')?.map((c: any) => c.name) ?? [];
    const mainPeople = [...directors.slice(0, 2), ...cast.slice(0, 3), ...writers.slice(0, 1)];
    return { cast, directors, writers, mainPeople };
  }

  private mapMediaType(mediaType: MediaType | string) {
    if (mediaType === 'movie') return 'movie';
    if (mediaType === 'tv') return 'tv';
    return 'tv';
  }

  private normalizeMediaType(value?: string): MediaType | null {
    if (!value) return null;
    if (value === 'movie') return 'movie';
    if (value === 'tv') return 'tv';
    return null;
  }

  private async safeGetOrCreate(tmdbId: number, mediaType: MediaType): Promise<Title | null> {
    try {
      return await this.titlesService.getOrCreateFromTmdb(tmdbId, mediaType);
    } catch (e) {
      this.logger.warn(`Skip candidate ${tmdbId}: ${String((e as Error).message)}`);
      return null;
    }
  }
}
