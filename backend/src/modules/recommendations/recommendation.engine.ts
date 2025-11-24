import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { MediaType, Prisma, Title, UserTitleState } from '@prisma/client';
import { TitlesService } from '../titles/titles.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { pickVariantForUser, profileConfig, weightVariants } from './recommendation.config';

export interface RecommendationSignals {
  rating: number;
  popularity: number;
  freshness?: number;
  similarity?: number;
  runtimeFit?: number;
  pace?: number;
  mood?: number;
  mindset?: number;
  company?: number;
  typePreference?: number;
  novelty?: number;
  diversity?: number;
  anti?: number;
  recency?: number;
  keywordMatch?: number;
  collectionMatch?: number;
  ageRatingFit?: number;
  runtime_bucket_short?: number;
  runtime_bucket_medium?: number;
  runtime_bucket_long?: number;
  context_mood_light?: number;
  context_mood_neutral?: number;
  context_mood_heavy?: number;
  context_company_solo?: number;
  context_company_duo?: number;
  context_company_friends?: number;
  context_company_family?: number;
  [key: string]: number | undefined;
}

export interface RecommendationOverrides {
  genre?: number;
  mood?: number;
  novelty?: number;
  decade?: number;
  country?: number;
  people?: number;
}

export interface RecommendationContext {
  mood?: string;
  mindset?: string;
  company?: string;
  timeAvailable?: string;
  noveltyBias?: 'safe' | 'mix' | 'surprise';
  pace?: 'calm' | 'balanced' | 'dynamic';
  freshness?: 'trending' | 'classic' | 'any';
  timeOfDay?: 'morning' | 'day' | 'evening' | 'late_night';
  dayOfWeek?: 'weekday' | 'weekend';
  diversityLevel?: 'soft' | 'balanced' | 'bold';
  overrides?: RecommendationOverrides;
}

export interface RecommendationResultItem {
  title: Title;
  score: number;
  signals: RecommendationSignals;
  explanation: string[];
}

type Candidate = Title;

interface AnchorTitle {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  genres: string[];
  people: string[];
  label: string;
  year?: number | null;
}

interface TasteProfileData {
  schemaVersion: number;
  genrePositive: Record<string, number>;
  genreNegative: Record<string, number>;
  countryWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  languageWeights: Record<string, number>;
  peopleWeights: Record<string, number>;
  keywordWeights: Record<string, number>;
  collectionWeights: Record<string, number>;
  ageRatingWeights: Record<string, number>;
  runtimeAvg: number | null;
  runtimeMedian: number | null;
  preferredTypes: MediaType[];
  likedTitleIds: string[];
  dislikedTitleIds: string[];
  seenTitleIds: string[];
  anchorTitles: AnchorTitle[];
  moodVector: Record<string, number>;
  freshnessTilt: number;
  languageDiversity: number;
  updatedAt: string;
}

interface GroupTasteData {
  schemaVersion: number;
  genrePositive: Record<string, number>;
  genreNegative: Record<string, number>;
  countryWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  languageWeights: Record<string, number>;
  peopleWeights: Record<string, number>;
  runtimeAvg: number | null;
  runtimeMedian: number | null;
  updatedAt: string;
}

interface UserTasteProfile
  extends Omit<
    TasteProfileData,
    'likedTitleIds' | 'dislikedTitleIds' | 'seenTitleIds' | 'preferredTypes'
  > {
  likedTitleIds: Set<string>;
  dislikedTitleIds: Set<string>;
  seenTitleIds: Set<string>;
  preferredTypes: Set<MediaType>;
}

@Injectable()
export class RecommendationEngine {
  private readonly logger = new Logger(RecommendationEngine.name);
  private readonly candidateCache = new Map<string, { expires: number; titles: Candidate[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly titlesService: TitlesService,
    private readonly tmdb: TmdbService,
  ) {}

  async recommend(
    userId: string,
    limit: number,
    context: RecommendationContext,
  ): Promise<RecommendationResultItem[]> {
    const startedAt = Date.now();
    const variant = pickVariantForUser(userId);
    const baseWeights = weightVariants[variant];
    const weights = { ...baseWeights };

    if (context.overrides?.genre) {
      weights.genre *= context.overrides.genre;
    }
    if (context.overrides?.mood) {
      weights.mood *= context.overrides.mood;
    }
    if (context.overrides?.novelty) {
      weights.novelty *= context.overrides.novelty;
    }
    if (context.overrides?.decade) {
      weights.decade *= context.overrides.decade;
    }
    if (context.overrides?.country) {
      weights.country *= context.overrides.country;
    }
    if (context.overrides?.people) {
      weights.people *= context.overrides.people;
    }
    const profile = await this.loadUserProfile(userId);
    const group = await this.loadGroupTasteProfile(userId, context.company);
    const effectiveProfile = group ? this.mergeProfiles(profile, group) : profile;
    const candidates = await this.buildCandidatePool(userId, effectiveProfile, limit * 10, context);

    const scored = candidates
      .filter((c) => !effectiveProfile.dislikedTitleIds.has(c.id))
      .map((title) => this.scoreCandidate(title, effectiveProfile, context, weights))
      .sort((a, b) => b.score - a.score);

    const diversified = this.diversify(scored, limit, context);
    const elapsedMs = Date.now() - startedAt;

    if (diversified.length > 0) {
      const topCount = Math.min(5, diversified.length);
      const avgTopScore =
        diversified.slice(0, topCount).reduce((sum, item) => sum + item.score, 0) / topCount;
      this.logger.log({
        msg: 'recommendations_generated',
        userId,
        variant,
        limit,
        candidateCount: candidates.length,
        returnedCount: diversified.length,
        avgTopScore: Number(avgTopScore.toFixed(3)),
        tookMs: elapsedMs,
      });
    } else {
      this.logger.log({
        msg: 'recommendations_generated',
        userId,
        variant,
        limit,
        candidateCount: candidates.length,
        returnedCount: 0,
        tookMs: elapsedMs,
      });
    }

    return diversified.map((item) => ({
      title: item.title,
      score: item.score,
      signals: item.signals,
      explanation: this.buildExplanation(item, effectiveProfile, context),
    }));
  }

  private async loadGroupTasteProfile(
    userId: string,
    company?: string,
  ): Promise<GroupTasteData | null> {
    if (!company || company === 'solo') return null;
    const row = await this.prisma.groupTasteProfile.findUnique({
      where: {
        userId_companyType: { userId, companyType: company },
      },
    });
    if (!row) return null;
    const data = row.data as unknown as Partial<GroupTasteData>;
    if (!data || data.schemaVersion !== 1) return null;
    return {
      schemaVersion: 1,
      genrePositive: data.genrePositive ?? {},
      genreNegative: data.genreNegative ?? {},
      countryWeights: data.countryWeights ?? {},
      decadeWeights: data.decadeWeights ?? {},
      languageWeights: data.languageWeights ?? {},
      peopleWeights: data.peopleWeights ?? {},
      runtimeAvg: data.runtimeAvg ?? null,
      runtimeMedian: data.runtimeMedian ?? null,
      updatedAt: data.updatedAt ?? new Date(0).toISOString(),
    };
  }

  private mergeProfiles(user: UserTasteProfile, group: GroupTasteData): UserTasteProfile {
    const mix = (u: Record<string, number>, g: Record<string, number>) => {
      const result: Record<string, number> = { ...u };
      Object.keys(g).forEach((key) => {
        const uVal = u[key] ?? 0;
        const gVal = g[key] ?? 0;
        result[key] = uVal * 0.6 + gVal * 0.4;
      });
      return result;
    };

    const merged: UserTasteProfile = {
      ...user,
      genrePositive: mix(user.genrePositive, group.genrePositive),
      genreNegative: mix(user.genreNegative, group.genreNegative),
      countryWeights: mix(user.countryWeights, group.countryWeights),
      decadeWeights: mix(user.decadeWeights, group.decadeWeights),
      languageWeights: mix(user.languageWeights, group.languageWeights),
      peopleWeights: mix(user.peopleWeights, group.peopleWeights),
      runtimeAvg:
        user.runtimeAvg !== null || group.runtimeAvg !== null
          ? ((user.runtimeAvg ?? group.runtimeAvg ?? 0) * 0.6 +
              (group.runtimeAvg ?? user.runtimeAvg ?? 0) * 0.4)
          : null,
      runtimeMedian: user.runtimeMedian,
    };

    return merged;
  }

  async rebuildUserTasteProfile(userId: string): Promise<void> {
    const states = await this.prisma.userTitleState.findMany({
      where: { userId },
      include: { title: true },
      orderBy: { lastInteractionAt: 'desc' },
    });

    const computed = this.computeProfile(states);
    await this.prisma.userTasteProfile.upsert({
      where: { userId },
      update: { data: computed as unknown as Prisma.InputJsonValue },
      create: { userId, data: computed as unknown as Prisma.InputJsonValue },
    });
  }

  private async loadUserProfile(userId: string): Promise<UserTasteProfile> {
    const cached = await this.prisma.userTasteProfile.findUnique({ where: { userId } });
    if (cached) {
      const cachedData = cached.data as unknown as Partial<TasteProfileData>;
      if (cachedData.schemaVersion === 3) {
        return this.deserializeProfile(cachedData as TasteProfileData);
      }
    }

    // Профиль ещё не построен или устарел по схеме — пересчитываем целиком.
    await this.rebuildUserTasteProfile(userId);
    const fresh = await this.prisma.userTasteProfile.findUnique({ where: { userId } });
    if (!fresh) {
      // Пользователь без взаимодействий — возвращаем пустой профиль.
      return this.deserializeProfile({
        schemaVersion: 3,
        genrePositive: {},
        genreNegative: {},
        countryWeights: {},
        decadeWeights: {},
        languageWeights: {},
        peopleWeights: {},
        keywordWeights: {},
        collectionWeights: {},
        ageRatingWeights: {},
        runtimeAvg: null,
        runtimeMedian: null,
        preferredTypes: [],
        likedTitleIds: [],
        dislikedTitleIds: [],
        seenTitleIds: [],
        anchorTitles: [],
        moodVector: { light: 0, neutral: 0, heavy: 0 },
        freshnessTilt: 0,
        languageDiversity: 0,
        updatedAt: new Date(0).toISOString(),
      });
    }

    const freshData = fresh.data as unknown as TasteProfileData;
    return this.deserializeProfile(freshData);
  }

  private computeProfile(states: (UserTitleState & { title: Title })[]): TasteProfileData {
    const genrePositive: Record<string, number> = {};
    const genreNegative: Record<string, number> = {};
    const countryWeights: Record<string, number> = {};
    const decadeWeights: Record<string, number> = {};
    const languageWeights: Record<string, number> = {};
    const peopleWeights: Record<string, number> = {};
    const keywordWeights: Record<string, number> = {};
    const collectionWeights: Record<string, number> = {};
    const ageRatingWeights: Record<string, number> = {};
    const runtimes: number[] = [];
    const preferredTypes = new Set<MediaType>();
    const likedTitleIds: string[] = [];
    const dislikedTitleIds: string[] = [];
    const seenTitleIds: string[] = [];
    const moodVector: Record<string, number> = { light: 0, neutral: 0, heavy: 0 };
    const now = Date.now();

    states.forEach((state) => {
      const { title } = state;
      const liked = state.liked;
      const hardDisliked = state.disliked;
      const dropped = !liked && !hardDisliked && state.status === 'dropped';

      let baseWeight: number;
      if (liked) {
        baseWeight = 3.0;
      } else if (hardDisliked) {
        baseWeight = -3.0;
      } else if (dropped) {
        baseWeight = -1.2;
      } else if (state.status === 'watched') {
        baseWeight = 1.6;
      } else {
        baseWeight = 0.8;
      }

      const daysAgo =
        (now - state.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
      const halfLife = profileConfig.recencyHalfLifeDays;
      const recencyFactor =
        halfLife > 0 ? Math.pow(0.5, daysAgo / halfLife) : 1;
      const sourceFactor = profileConfig.sourceWeights[state.source] ?? 1;
      const weight = baseWeight * recencyFactor * sourceFactor;

      if (liked) likedTitleIds.push(title.id);
      if (hardDisliked || dropped) dislikedTitleIds.push(title.id);
      seenTitleIds.push(title.id);
      preferredTypes.add(title.mediaType);

      title.genres?.forEach((g) => {
        if (hardDisliked) {
          genreNegative[g] = (genreNegative[g] ?? 0) + Math.abs(weight);
        } else if (dropped) {
          // дроп считаем мягким негативом, а не полным дизлайком
          genreNegative[g] = (genreNegative[g] ?? 0) + Math.abs(weight) * 0.4;
        } else {
          genrePositive[g] = (genrePositive[g] ?? 0) + weight;
        }
        moodVector.light += ['комедия', 'анимация', 'семейный'].some((k) =>
          g.toLowerCase().includes(k),
        )
          ? weight * 0.4
          : 0;
        moodVector.heavy += ['драма', 'триллер', 'ужасы', 'криминал'].some((k) =>
          g.toLowerCase().includes(k),
        )
          ? weight * 0.35
          : 0;
      });

      title.countries?.forEach((c) => {
        countryWeights[c] = (countryWeights[c] ?? 0) + weight * 0.7;
      });

      if (title.originalLanguage) {
        languageWeights[title.originalLanguage] =
          (languageWeights[title.originalLanguage] ?? 0) + weight * 0.5;
      }

      const year = title.releaseDate?.getFullYear();
      if (year) {
        const decade = Math.floor(year / 10) * 10;
        decadeWeights[String(decade)] = (decadeWeights[String(decade)] ?? 0) + weight * 0.8;
      }

      const { mainPeople } = this.extractPeople(title);
      mainPeople.forEach((p) => {
        peopleWeights[p] = (peopleWeights[p] ?? 0) + weight * 0.55;
      });

      if (title.runtime) runtimes.push(title.runtime);

      const { keywords, collectionName, ageRating } = this.extractExtraSignals(title);
      keywords.forEach((keyword) => {
        keywordWeights[keyword] = (keywordWeights[keyword] ?? 0) + weight;
      });
      if (collectionName) {
        collectionWeights[collectionName] =
          (collectionWeights[collectionName] ?? 0) + weight;
      }
      if (ageRating) {
        ageRatingWeights[ageRating] = (ageRatingWeights[ageRating] ?? 0) + weight;
      }
    });

    const runtimeAvg = runtimes.length
      ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
      : null;
    const runtimeMedian = runtimes.length
      ? runtimes.sort((a, b) => a - b)[Math.floor(runtimes.length / 2)]
      : null;

    const freshnessTilt = this.computeFreshnessTilt(states);
    const languageDiversity = Object.keys(languageWeights).length;

    const anchorTitles: AnchorTitle[] = states
      .filter((s) => s.liked)
      .slice(0, 6)
      .map((s) => ({
        id: s.title.id,
        tmdbId: s.title.tmdbId,
        mediaType: s.title.mediaType,
        genres: s.title.genres ?? [],
        people: this.extractPeople(s.title).mainPeople,
        label: s.title.russianTitle ?? s.title.originalTitle,
        year: s.title.releaseDate?.getFullYear() ?? null,
      }));

    return {
      schemaVersion: 3,
      genrePositive,
      genreNegative,
      countryWeights,
      decadeWeights,
      languageWeights,
      peopleWeights,
      keywordWeights,
      collectionWeights,
      ageRatingWeights,
      runtimeAvg,
      runtimeMedian,
      preferredTypes: Array.from(preferredTypes),
      likedTitleIds,
      dislikedTitleIds,
      seenTitleIds,
      anchorTitles,
      moodVector,
      freshnessTilt,
      languageDiversity,
      updatedAt: new Date().toISOString(),
    };
  }

  private deserializeProfile(data: TasteProfileData): UserTasteProfile {
    return {
      ...data,
      likedTitleIds: new Set(data.likedTitleIds),
      dislikedTitleIds: new Set(data.dislikedTitleIds),
      seenTitleIds: new Set(data.seenTitleIds),
      preferredTypes: new Set(data.preferredTypes),
    };
  }

  private computeFreshnessTilt(states: (UserTitleState & { title: Title })[]) {
    const years = states
      .filter((s) => s.title.releaseDate)
      .map((s) => s.title.releaseDate!.getFullYear())
      .filter(Boolean);
    if (!years.length) return 0;
    const avgYear = years.reduce((a, b) => a + b, 0) / years.length;
    return Math.max(-1, Math.min(1, (avgYear - 2012) / 15));
  }

  private extractExtraSignals(title: Title) {
    const raw = (title.rawTmdbJson ?? {}) as any;

    const keywordsRaw = raw?.keywords;
    const keywordItems: any[] = Array.isArray(keywordsRaw)
      ? keywordsRaw
      : Array.isArray(keywordsRaw?.keywords)
        ? keywordsRaw.keywords
        : Array.isArray(keywordsRaw?.results)
          ? keywordsRaw.results
          : [];
    const keywords: string[] = keywordItems
      .map((k) => k?.name)
      .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)
      .slice(0, 16);

    const collectionName: string | null =
      typeof raw?.belongs_to_collection?.name === 'string'
        ? (raw.belongs_to_collection.name as string)
        : null;

    let ageRating: string | null = null;
    if (title.mediaType === 'movie') {
      const releases: any[] = Array.isArray(raw?.release_dates?.results)
        ? raw.release_dates.results
        : [];
      const ru = releases.find((r) => r?.iso_3166_1 === 'RU');
      const us = releases.find((r) => r?.iso_3166_1 === 'US');
      const base = ru ?? us ?? releases[0];
      const certSource: any[] = Array.isArray(base?.release_dates) ? base.release_dates : [];
      const cert = certSource.find((r) => typeof r?.certification === 'string')?.certification;
      if (typeof cert === 'string' && cert.trim().length > 0) {
        ageRating = cert.trim();
      }
    } else {
      const ratings: any[] = Array.isArray(raw?.content_ratings?.results)
        ? raw.content_ratings.results
        : [];
      const ru = ratings.find((r) => r?.iso_3166_1 === 'RU');
      const us = ratings.find((r) => r?.iso_3166_1 === 'US');
      const base = ru ?? us ?? ratings[0];
      const cert = base?.rating;
      if (typeof cert === 'string' && cert.trim().length > 0) {
        ageRating = cert.trim();
      }
    }

    return { keywords, collectionName, ageRating };
  }

  private cacheKey(userId: string, context: RecommendationContext, profileUpdatedAt: string) {
    // Включаем updatedAt профиля вкуса, чтобы кэш кандидатов автоматически
    // инвалидавался после новых лайков/дизлайков/просмотров.
    return `${userId}:${profileUpdatedAt}:${context.mood ?? 'm'}:${context.mindset ?? 'ms'}:${context.company ?? 'c'}:${context.timeAvailable ?? 't'}:${context.noveltyBias ?? 'mix'}:${context.freshness ?? 'any'}`;
  }

  private async buildCandidatePool(
    userId: string,
    profile: UserTasteProfile,
    targetSize: number,
    context: RecommendationContext,
  ): Promise<Candidate[]> {
    const key = this.cacheKey(userId, context, profile.updatedAt);
    const cached = this.candidateCache.get(key);
    const now = Date.now();
    if (cached && cached.expires > now) {
      return cached.titles.slice(0, targetSize);
    }

    const excludeTitleIds = new Set<string>([...profile.seenTitleIds, ...profile.dislikedTitleIds]);
    const recentServed = await this.prisma.recommendationItem.findMany({
      where: { session: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: { titleId: true },
    });
    recentServed.forEach((i) => excludeTitleIds.add(i.titleId));

    const seeds: { tmdbId: number; mediaType: MediaType }[] = [];

    // похожие к любимым тайтлам
    const similarSeeds = await Promise.all(
      (profile.anchorTitles ?? []).slice(0, 4).map(async (anchor) => {
        const similar = await this.tmdb.similar(anchor.tmdbId, this.mapMediaType(anchor.mediaType));
        return (similar?.results ?? [])
          .slice(0, 12)
          .map((r: any) => ({ tmdbId: r.id, mediaType: anchor.mediaType }));
      }),
    );
    similarSeeds.flat().forEach((s) => seeds.push(s));

    // тренды
    const mediaTypes =
      profile.preferredTypes.size > 0 ? Array.from(profile.preferredTypes) : ['movie', 'tv'];

    for (const mt of mediaTypes) {
      const mediaType = mt as MediaType;
      const latestTrending = await this.prisma.catalogSnapshot.findFirst({
        where: { mediaType, kind: 'trending' },
        orderBy: { snapshotDate: 'desc' },
      });

      if (latestTrending) {
        const rows = await this.prisma.catalogSnapshot.findMany({
          where: {
            mediaType,
            kind: 'trending',
            snapshotDate: latestTrending.snapshotDate,
          },
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: 40,
        });

        rows.forEach((row) => {
          seeds.push({ tmdbId: row.tmdbId, mediaType: row.mediaType });
        });
      } else {
        const res = await this.tmdb.trending(this.mapMediaType(mediaType));
        (res?.results ?? []).slice(0, 15).forEach((r: any) => {
          const resolvedType =
            this.normalizeMediaType(r.media_type) ?? (mediaType as MediaType);
          seeds.push({ tmdbId: r.id, mediaType: resolvedType });
        });
      }
    }

    // популярное как fallback
    if (context.freshness === 'classic') {
      for (const mt of mediaTypes) {
        const mediaType = mt as MediaType;
        const latestPopular = await this.prisma.catalogSnapshot.findFirst({
          where: { mediaType, kind: 'popular' },
          orderBy: { snapshotDate: 'desc' },
        });

        if (latestPopular) {
          const rows = await this.prisma.catalogSnapshot.findMany({
            where: {
              mediaType,
              kind: 'popular',
              snapshotDate: latestPopular.snapshotDate,
            },
            orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
            take: 30,
          });

          rows.forEach((row) => {
            seeds.push({ tmdbId: row.tmdbId, mediaType: row.mediaType });
          });
        } else {
          const res = await this.tmdb.popular(this.mapMediaType(mediaType));
          (res?.results ?? []).slice(0, 12).forEach((r: any) => {
            const resolvedType =
              this.normalizeMediaType(r.media_type) ?? (mediaType as MediaType);
            seeds.push({ tmdbId: r.id, mediaType: resolvedType });
          });
        }
      }
    }

    const local = await this.prisma.title.findMany({
      where: { id: { notIn: Array.from(excludeTitleIds) } },
      orderBy: { updatedAt: 'desc' },
      take: targetSize,
    });

    const resolvedSeeds = await this.resolveSeeds(seeds, excludeTitleIds, targetSize * 2);
    const candidates = [...resolvedSeeds, ...local].filter(
      (c, idx, arr) => arr.findIndex((t) => t.id === c.id) === idx,
    );

    const limited = candidates.slice(0, targetSize);
    this.candidateCache.set(key, { titles: limited, expires: now + 5 * 60 * 1000 });
    return limited;
  }

  private async resolveSeeds(
    seeds: { tmdbId: number; mediaType: MediaType }[],
    excludeTitleIds: Set<string>,
    target: number,
  ): Promise<Title[]> {
    const seenTmdb = new Set<number>();
    const uniqueSeeds = seeds.filter((s) => {
      if (seenTmdb.has(s.tmdbId)) return false;
      seenTmdb.add(s.tmdbId);
      return true;
    });

    const batchSize = 6;
    const result: Title[] = [];
    for (let i = 0; i < uniqueSeeds.length && result.length < target; i += batchSize) {
      const batch = uniqueSeeds.slice(i, i + batchSize);
      const resolved = await Promise.all(
        batch.map((seed) => this.safeGetOrCreate(seed.tmdbId, seed.mediaType)),
      );
      resolved
        .filter((t): t is Title => Boolean(t) && !excludeTitleIds.has((t as Title).id))
        .forEach((t) => result.push(t));
    }
    return result;
  }

  private scoreCandidate(
    title: Title,
    profile: UserTasteProfile,
    context: RecommendationContext,
    weights: (typeof weightVariants)['A'],
  ) {
    const signals: RecommendationSignals = {
      rating: 0,
      popularity: 0,
    };
    const reasons: Set<string> = new Set();
    let score = 0;

    const raw = (title.rawTmdbJson ?? {}) as any;
    const year = title.releaseDate?.getFullYear();
    const currentYear = new Date().getFullYear();

    // оценки и популярность
    const ratingScore = (title.tmdbRating ?? 6) / 10;
    const popularity = raw?.popularity ?? (title.tmdbRating ?? 6) * 12;
    const popularityScore = Math.min(1, popularity / 400);
    signals.rating = ratingScore;
    signals.popularity = popularityScore;
    score += ratingScore * weights.rating + popularityScore * weights.popularity;
    if (ratingScore > 0.78) reasons.add('Высокие оценки зрителей и критиков');

    // жанры
    let genreScore = 0;
    (title.genres ?? []).forEach((g) => {
      const positive = profile.genrePositive[g] ?? 0;
      const negative = profile.genreNegative[g] ?? 0;
      const value = positive - negative;
      signals[`genre:${g}`] = value;
      genreScore += value;
      if (positive > 1.5) reasons.add(`Любите жанр «${g}»`);
      if (negative > 1.2) reasons.add(`Обычно избегаете жанра «${g}»`);
    });
    score += genreScore * weights.genre;

    // страны
    let countryScore = 0;
    (title.countries ?? []).forEach((c) => {
      const val = profile.countryWeights[c] ?? 0;
      signals[`country:${c}`] = val;
      countryScore += val;
    });
    score += countryScore * weights.country;

    // десятилетие и свежесть
    if (year) {
      const decade = Math.floor(year / 10) * 10;
      const decadeWeight = profile.decadeWeights[String(decade)] ?? 0;
      signals[`decade:${decade}`] = decadeWeight;
      const freshness = Math.max(0, 1 - (currentYear - year) / 40);
      signals.freshness = freshness;
      const recency = profile.freshnessTilt * 0.6 + freshness * 0.4;
      signals.recency = recency;
      score +=
        decadeWeight * weights.decade + recency * weights.recency + freshness * weights.freshness;
      if (freshness > 0.7 && (context.freshness ?? 'any') !== 'classic')
        reasons.add('Свежая новинка последних лет');
      if (decadeWeight > 1) reasons.add(`Вы любите тайтлы ${decade}-х`);
    }

    // язык
    if (title.originalLanguage) {
      const langBoost = (profile.languageWeights[title.originalLanguage] ?? 0.1) / 2;
      signals[`lang:${title.originalLanguage}`] = langBoost;
      score += langBoost * weights.language;
    }

    // люди
    const { cast, directors, writers, mainPeople } = this.extractPeople(title);
    let peopleScore = 0;
    [...directors, ...writers, ...cast.slice(0, 6)].forEach((p) => {
      const val = profile.peopleWeights[p] ?? 0;
      signals[`person:${p}`] = val;
      peopleScore += val;
      if (val > 1.1) reasons.add(`В ролях/постановке ${p}, чьи работы вам нравятся`);
    });
    score += peopleScore * weights.people;

    // keywords / коллекции / возрастной рейтинг
    const { keywords, collectionName, ageRating } = this.extractExtraSignals(title);

    if (keywords.length) {
      let keywordScore = 0;
      keywords.forEach((keyword) => {
        const value = profile.keywordWeights[keyword] ?? 0;
        if (!value) return;
        signals[`keyword:${keyword}`] = value;
        keywordScore += value;
      });
      if (keywordScore !== 0) {
        signals.keywordMatch = keywordScore;
        score += keywordScore * (weights.keyword ?? 0);
        if (keywordScore > 1.5) {
          reasons.add('Совпадает по скрытым тегам и темам, которые вам нравятся');
        }
      }
    }

    if (collectionName) {
      const value = profile.collectionWeights[collectionName] ?? 0;
      if (value !== 0) {
        signals[`collection:${collectionName}`] = value;
        signals.collectionMatch = value;
        score += value * (weights.collection ?? 0);
        if (value > 1.1) {
          reasons.add(`Вы любите тайтлы из вселенной «${collectionName}»`);
        }
      }
    }

    if (ageRating) {
      let ageScore = profile.ageRatingWeights[ageRating] ?? 0;
      const isAdultRating =
        ageRating.includes('18') ||
        ageRating.toUpperCase() === 'R' ||
        ageRating.toUpperCase() === 'NC-17' ||
        raw?.adult === true;
      if (context.company === 'family' && isAdultRating) {
        ageScore -= 1.2;
      }
      if (ageScore !== 0) {
        signals.ageRatingFit = ageScore;
        score += ageScore * (weights.ageRating ?? 0);
      }
    }

    // схожесть с любимыми
    const similarity = this.anchorSimilarity(title, profile.anchorTitles ?? []);
    signals.similarity = similarity.score;
    score += similarity.score * weights.similarity;
    if (similarity.anchorLabel)
      reasons.add(`Похоже на «${similarity.anchorLabel}» из ваших любимых`);

    // runtime + контекст времени и темпа
    if (title.runtime) {
      let target = profile.runtimeAvg ?? 100;
      if (context.timeAvailable) target = Number(context.timeAvailable);
      const diff = Math.abs(title.runtime - target);
      const runtimeScore = Math.max(0, 1 - diff / Math.max(target, 130));
      signals.runtimeFit = runtimeScore;
      score += runtimeScore * weights.runtime;

      const short = title.runtime < 85 ? 1 : 0;
      const medium = title.runtime >= 85 && title.runtime <= 130 ? 1 : 0;
      const long = title.runtime > 130 ? 1 : 0;
      signals.runtime_bucket_short = short;
      signals.runtime_bucket_medium = medium;
      signals.runtime_bucket_long = long;

      const pace = context.pace ?? 'balanced';
      const paceScore =
        pace === 'calm'
          ? title.runtime > 110
            ? 0.4
            : 0.15
          : pace === 'dynamic'
            ? title.runtime < 115
              ? 0.35
              : 0.1
            : 0.2;
      signals.pace = paceScore;
      score += paceScore * weights.contextPace;
      if (runtimeScore > 0.7 && context.timeAvailable)
        reasons.add('Укладывается во время, которое вы запланировали');
    }

    // настроение, mindset, компания
    const moodBoost = this.mapMoodBoost(context.mood, title.genres ?? []);
    if (moodBoost > 0) {
      signals.mood = moodBoost;
      score += moodBoost * weights.mood;
      reasons.add('Соответствует выбранному настроению');
    }
    signals.context_mood_light = context.mood === 'light' ? 1 : 0;
    signals.context_mood_neutral = context.mood === 'neutral' ? 1 : 0;
    signals.context_mood_heavy = context.mood === 'heavy' ? 1 : 0;

    const mindsetBoost = this.mapMindsetBoost(context.mindset, ratingScore);
    signals.mindset = mindsetBoost;
    score += mindsetBoost * weights.mindset;

    const companyPenalty = this.companyPenalty(context.company, raw);
    signals.company = companyPenalty;
    score += companyPenalty * weights.company;
    signals.context_company_solo = !context.company || context.company === 'solo' ? 1 : 0;
    signals.context_company_duo = context.company === 'duo' ? 1 : 0;
    signals.context_company_friends = context.company === 'friends' ? 1 : 0;
    signals.context_company_family = context.company === 'family' ? 1 : 0;

    // тип и новизна
    const typePref = profile.preferredTypes.has(title.mediaType) ? 1 : 0.65;
    signals.typePreference = typePref;
    score += typePref * weights.typePreference;

    let novelty = profile.seenTitleIds.has(title.id) ? -0.9 : 0.25;
    if (context.noveltyBias === 'surprise') novelty += 0.35;
    if (context.noveltyBias === 'safe') novelty -= 0.15;
    signals.novelty = novelty;
    score += novelty * weights.novelty;
    if (novelty > 0.3) reasons.add('Добавляем немного нового, чтобы расширить кругозор');

    // диверсификация
    const diversity = Math.min(
      0.4,
      (title.genres?.length ?? 1) * 0.08 + profile.languageDiversity * 0.01,
    );
    signals.diversity = diversity;
    score += diversity * weights.diversity;

    // анти-лист
    const antiHit = (title.genres ?? []).reduce(
      (acc, g) => acc + (profile.genreNegative[g] ?? 0),
      0,
    );
    const antiScore = antiHit ? -Math.min(1.2, antiHit / 3) : 0;
    signals.anti = antiScore;
    score += antiScore * weights.anti;

    // время суток и день недели
    if (context.timeOfDay || context.dayOfWeek) {
      let timeScore = 0;
      const isWeekend = context.dayOfWeek === 'weekend';
      const isLateNight = context.timeOfDay === 'late_night' || context.timeOfDay === 'evening';

      if (isLateNight && title.runtime && title.runtime <= 110) {
        timeScore += 0.12;
      }

      const isAdult =
        raw?.adult === true ||
        (typeof raw?.release_dates === 'object' && String(raw.release_dates).includes('18+'));

      if (isWeekend && context.company === 'family' && !isAdult) {
        timeScore += 0.15;
      }

      if (timeScore !== 0) {
        (signals as any).timeOfDay = timeScore;
        score += timeScore * weights.runtime;
        if (isLateNight && title.runtime && title.runtime <= 110) {
          reasons.add('Подходит для позднего вечера по длительности');
        }
        if (isWeekend && context.company === 'family' && !isAdult) {
          reasons.add('Семейный вариант на выходные без жёсткого контента');
        }
      }
    }

    return { title, score, signals, reasons: Array.from(reasons) };
  }

  private diversify(
    items: { title: Title; score: number; signals: RecommendationSignals; reasons: string[] }[],
    limit: number,
    context: RecommendationContext,
  ) {
    const picked: typeof items = [];
    const usedGenres = new Set<string>();
    const usedPeople = new Set<string>();
    const level = context.diversityLevel ?? 'balanced';
    const minIndexToEnforce = level === 'soft' ? 4 : level === 'bold' ? 2 : 3;

    for (const item of items) {
      if (picked.length >= limit) break;
      const genreOverlap = (item.title.genres ?? []).some((g) => usedGenres.has(g));
      const peopleOverlap = this.extractPeople(item.title).mainPeople.some((p) =>
        usedPeople.has(p),
      );
      if ((genreOverlap || peopleOverlap) && picked.length >= minIndexToEnforce) continue;
      picked.push(item);
      item.title.genres?.forEach((g) => usedGenres.add(g));
      this.extractPeople(item.title).mainPeople.forEach((p) => usedPeople.add(p));
    }

    if (picked.length < limit) picked.push(...items.slice(picked.length, limit));

    const base = picked.slice(0, limit);

    // slot для «рискованной» рекомендации:
    // стараемся подмешать один тайтл с высокой новизной, которого ещё нет в выдаче.
    let bestNovelty = 0;
    let bestNoveltyItem: (typeof items)[number] | null = null;
    for (const item of items) {
      const novelty = (item.signals.novelty ?? 0) as number;
      if (novelty > 0.4 && novelty > bestNovelty && !base.some((b) => b.title.id === item.title.id)) {
        bestNovelty = novelty;
        bestNoveltyItem = item;
      }
    }

    if (bestNoveltyItem && base.length > 0) {
      base[base.length - 1] = bestNoveltyItem;
    }

    // дополнительный «экспериментальный» слот при высоком уровне диверсификации:
    // выбираем тайтл с наибольшей диверсификацией, которого ещё нет в выдаче.
    if (context.diversityLevel === 'bold' && base.length >= 3) {
      let bestDiversity = 0;
      let bestDiversityItem: (typeof items)[number] | null = null;
      for (const item of items) {
        const diversity = (item.signals.diversity ?? 0) as number;
        if (
          diversity > bestDiversity &&
          !base.some((b) => b.title.id === item.title.id)
        ) {
          bestDiversity = diversity;
          bestDiversityItem = item;
        }
      }
      if (bestDiversityItem) {
        base[2] = bestDiversityItem;
      }
    }

    return base.slice(0, limit);
  }

  private buildExplanation(
    item: { title: Title; score: number; signals: RecommendationSignals; reasons: string[] },
    profile: UserTasteProfile,
    context: RecommendationContext,
  ) {
    const reasons = new Set<string>(item.reasons);
    const year = item.title.releaseDate?.getFullYear();

    if (reasons.size < 4) {
      const sortedSignals = Object.entries(item.signals)
        .filter(([, value]) => typeof value === 'number' && !Number.isNaN(value))
        .sort((a, b) => Math.abs((b[1] as number) ?? 0) - Math.abs((a[1] as number) ?? 0));

      for (const [key, value] of sortedSignals) {
        if (reasons.size >= 4) break;
        if (Math.abs((value as number) ?? 0) < 0.35) continue;

        if (key.startsWith('genre:') && !Array.from(reasons).some((r) => r.includes('жанр'))) {
          const genreName = key.replace('genre:', '');
          reasons.add(`Сильно совпадает по жанру «${genreName}»`);
          continue;
        }

        if (key === 'similarity' && (value as number) > 0.2) {
          reasons.add('Похоже на ваши любимые тайтлы');
          continue;
        }

        if (key === 'runtimeFit' && (value as number) > 0.6) {
          reasons.add('Хорошо укладывается во время, которое вы обычно выделяете');
          continue;
        }

        if (key === 'novelty' && (value as number) > 0.3) {
          reasons.add('Добавляет новизну, не выходя за рамки вашего вкуса');
          continue;
        }
      }
    }

    // подчёркиваем экспериментальные рекомендации, когда пользователь выбрал режим сюрпризов
    if (
      context.noveltyBias === 'surprise' &&
      (item.signals.novelty ?? 0) !== undefined &&
      (item.signals.novelty as number) > 0.35
    ) {
      reasons.add('Экспериментальный выбор под ваш запрос сюрпризов');
    }

    if (!reasons.size && item.title.tmdbRating) {
      reasons.add(`Оценка TMDB ${item.title.tmdbRating.toFixed(1)} — выше среднего`);
    }
    if (!reasons.size && year) reasons.add(`Подходит под ваши любимые годы (${year})`);
    if (!reasons.size) reasons.add('Сбалансированное совпадение с вашим профилем вкуса');

    // подсказка про антисписок — только если текущий тайтл сам почти не задевает стоп‑жанры
    const antiSignal = (item.signals.anti ?? 0) as number;
    if (profile.genreNegative && Object.keys(profile.genreNegative).length > 0 && antiSignal >= -0.05) {
      reasons.add('Мы стараемся обходить ваши стоп-жанры и антисписок');
    }

    return Array.from(reasons).slice(0, 4);
  }

  private mapMoodBoost(mood: string | undefined, genres: string[]): number {
    if (!mood) return 0.05;
    const moodMap: Record<string, string[]> = {
      light: ['комедия', 'анимация', 'приключения', 'семейный'],
      neutral: ['драма', 'триллер', 'фэнтези'],
      heavy: ['триллер', 'криминал', 'драма', 'ужасы'],
    };
    const target = moodMap[mood] ?? [];
    const overlap = genres.filter((g) => target.some((t) => g.toLowerCase().includes(t))).length;
    return Math.min(0.45, overlap * 0.15);
  }

  private mapMindsetBoost(mindset: string | undefined, rating: number): number {
    if (!mindset) return 0.08;
    if (mindset === 'focus') return Math.min(0.45, (rating - 0.6) * 0.4);
    if (mindset === 'relax') return 0.18;
    return 0.12;
  }

  private companyPenalty(company: string | undefined, raw: any): number {
    if (!company) return 0.1;
    const isAdult = raw?.adult === true;
    if (company === 'family' && isAdult) return -0.9;
    if (company === 'family') return 0.25;
    if (company === 'friends') return 0.18;
    if (company === 'duo') return 0.12;
    return 0.08;
  }

  private extractPeople(title: Title) {
    const raw = (title.rawTmdbJson ?? {}) as any;
    const cast: string[] =
      raw?.credits?.cast
        ?.slice(0, 8)
        ?.map((c: any) => c.name)
        ?.filter(Boolean) ?? [];
    const directors: string[] =
      raw?.credits?.crew?.filter((c: any) => c.job === 'Director')?.map((c: any) => c.name) ?? [];
    const writers: string[] =
      raw?.credits?.crew?.filter((c: any) => c.department === 'Writing')?.map((c: any) => c.name) ??
      [];
    const mainPeople = [...directors.slice(0, 2), ...cast.slice(0, 4), ...writers.slice(0, 1)];
    return { cast, directors, writers, mainPeople };
  }

  private anchorSimilarity(title: Title, anchors: AnchorTitle[]) {
    let best = 0;
    let anchorLabel: string | null = null;
    anchors.forEach((a) => {
      const genreOverlap = this.jaccard(title.genres ?? [], a.genres ?? []);
      const peopleOverlap = this.jaccard(this.extractPeople(title).mainPeople, a.people ?? []);
      const score = genreOverlap * 0.6 + peopleOverlap * 0.4;
      if (score > best) {
        best = score;
        anchorLabel = a.label;
      }
    });
    return { score: best, anchorLabel };
  }

  private jaccard(a: string[] = [], b: string[] = []) {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...a, ...b]).size || 1;
    return intersection / union;
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
      this.logger.debug(`Skip candidate ${tmdbId}: ${String((e as Error).message)}`);
      return null;
    }
  }

}
