import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { MediaType, Title, UserTitleState } from '@prisma/client';
import { TitlesService } from '../titles/titles.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { weightVariants, WeightVariant } from './recommendation.config';

export interface RecommendationContext {
  mood?: string;
  mindset?: string;
  company?: string;
  timeAvailable?: string;
  noveltyBias?: 'safe' | 'mix' | 'surprise';
  pace?: 'calm' | 'balanced' | 'dynamic';
  freshness?: 'trending' | 'classic' | 'any';
}

export interface RecommendationResultItem {
  title: Title;
  score: number;
  signals: Record<string, number>;
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
  genrePositive: Record<string, number>;
  genreNegative: Record<string, number>;
  countryWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  languageWeights: Record<string, number>;
  peopleWeights: Record<string, number>;
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

interface UserTasteProfile extends Omit<TasteProfileData, 'likedTitleIds' | 'dislikedTitleIds' | 'seenTitleIds' | 'preferredTypes'> {
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

  async recommend(userId: string, limit: number, context: RecommendationContext): Promise<RecommendationResultItem[]> {
    const variant = this.pickVariant(userId);
    const weights = weightVariants[variant];
    const profile = await this.loadUserProfile(userId);
    const candidates = await this.buildCandidatePool(userId, profile, limit * 10, context);

    const scored = candidates
      .filter((c) => !profile.dislikedTitleIds.has(c.id))
      .map((title) => this.scoreCandidate(title, profile, context, weights))
      .sort((a, b) => b.score - a.score);

    const diversified = this.diversify(scored, limit);
    return diversified.map((item) => ({
      title: item.title,
      score: item.score,
      signals: item.signals,
      explanation: this.buildExplanation(item, profile, context),
    }));
  }

  private async loadUserProfile(userId: string): Promise<UserTasteProfile> {
    const states = await this.prisma.userTitleState.findMany({
      where: { userId },
      include: { title: true },
      orderBy: { lastInteractionAt: 'desc' },
    });

    const latestInteraction = states[0]?.lastInteractionAt ?? new Date(0);
    const cached = await this.prisma.userTasteProfile.findUnique({ where: { userId } });
    if (cached && cached.updatedAt >= latestInteraction) {
      return this.deserializeProfile(cached.data as TasteProfileData);
    }

    const computed = this.computeProfile(states);
    await this.prisma.userTasteProfile.upsert({
      where: { userId },
      update: { data: computed },
      create: { userId, data: computed },
    });

    return this.deserializeProfile(computed);
  }

  private computeProfile(states: (UserTitleState & { title: Title })[]): TasteProfileData {
    const genrePositive: Record<string, number> = {};
    const genreNegative: Record<string, number> = {};
    const countryWeights: Record<string, number> = {};
    const decadeWeights: Record<string, number> = {};
    const languageWeights: Record<string, number> = {};
    const peopleWeights: Record<string, number> = {};
    const runtimes: number[] = [];
    const preferredTypes = new Set<MediaType>();
    const likedTitleIds: string[] = [];
    const dislikedTitleIds: string[] = [];
    const seenTitleIds: string[] = [];
    const moodVector: Record<string, number> = { light: 0, neutral: 0, heavy: 0 };

    states.forEach((state) => {
      const { title } = state;
      const liked = state.liked;
      const disliked = state.disliked || state.status === 'dropped';
      const weight = liked ? 2.8 : disliked ? -3 : state.status === 'watched' ? 1.4 : 0.6;

      if (liked) likedTitleIds.push(title.id);
      if (disliked) dislikedTitleIds.push(title.id);
      seenTitleIds.push(title.id);
      preferredTypes.add(title.mediaType);

      title.genres?.forEach((g) => {
        if (disliked) {
          genreNegative[g] = (genreNegative[g] ?? 0) + Math.abs(weight);
        } else {
          genrePositive[g] = (genrePositive[g] ?? 0) + weight;
        }
        moodVector.light += ['комедия', 'анимация', 'семейный'].some((k) => g.toLowerCase().includes(k)) ? weight * 0.4 : 0;
        moodVector.heavy += ['драма', 'триллер', 'ужасы', 'криминал'].some((k) => g.toLowerCase().includes(k)) ? weight * 0.35 : 0;
      });

      title.countries?.forEach((c) => {
        countryWeights[c] = (countryWeights[c] ?? 0) + weight * 0.7;
      });

      if (title.originalLanguage) {
        languageWeights[title.originalLanguage] = (languageWeights[title.originalLanguage] ?? 0) + weight * 0.5;
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
    });

    const runtimeAvg = runtimes.length ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null;
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
      genrePositive,
      genreNegative,
      countryWeights,
      decadeWeights,
      languageWeights,
      peopleWeights,
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

  private cacheKey(userId: string, context: RecommendationContext) {
    return `${userId}:${context.mood ?? 'm'}:${context.mindset ?? 'ms'}:${context.company ?? 'c'}:${context.timeAvailable ?? 't'}:${context.noveltyBias ?? 'mix'}:${context.freshness ?? 'any'}`;
  }

  private async buildCandidatePool(
    userId: string,
    profile: UserTasteProfile,
    targetSize: number,
    context: RecommendationContext,
  ): Promise<Candidate[]> {
    const key = this.cacheKey(userId, context);
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
        return (similar?.results ?? []).slice(0, 12).map((r: any) => ({ tmdbId: r.id, mediaType: anchor.mediaType }));
      }),
    );
    similarSeeds.flat().forEach((s) => seeds.push(s));

    // тренды
    const mediaTypes = profile.preferredTypes.size > 0 ? Array.from(profile.preferredTypes) : ['movie', 'tv'];
    const trendPromises = mediaTypes.map((mt) => this.tmdb.trending(this.mapMediaType(mt)));
    const trendResults = await Promise.all(trendPromises);
    trendResults.forEach((res, idx) => {
      (res?.results ?? []).slice(0, 15).forEach((r: any) => {
        const resolvedType = this.normalizeMediaType(r.media_type) ?? (mediaTypes[idx] as MediaType);
        seeds.push({ tmdbId: r.id, mediaType: resolvedType });
      });
    });

    // популярное как fallback
    if (context.freshness === 'classic') {
      const popular = await Promise.all(mediaTypes.map((mt) => this.tmdb.popular(this.mapMediaType(mt))));
      popular.forEach((res, idx) => {
        (res?.results ?? []).slice(0, 12).forEach((r: any) => {
          seeds.push({ tmdbId: r.id, mediaType: mediaTypes[idx] as MediaType });
        });
      });
    }

    const local = await this.prisma.title.findMany({
      where: { id: { notIn: Array.from(excludeTitleIds) } },
      orderBy: { updatedAt: 'desc' },
      take: targetSize,
    });

    const resolvedSeeds = await this.resolveSeeds(seeds, excludeTitleIds, targetSize * 2);
    const candidates = [...resolvedSeeds, ...local].filter((c, idx, arr) => arr.findIndex((t) => t.id === c.id) === idx);

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
    weights: typeof weightVariants['A'],
  ) {
    const signals: Record<string, number> = {};
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
      score += decadeWeight * weights.decade + recency * weights.recency + freshness * weights.freshness;
      if (freshness > 0.7 && (context.freshness ?? 'any') !== 'classic') reasons.add('Свежая новинка последних лет');
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

    // схожесть с любимыми
    const similarity = this.anchorSimilarity(title, profile.anchorTitles ?? []);
    signals.similarity = similarity.score;
    score += similarity.score * weights.similarity;
    if (similarity.anchorLabel) reasons.add(`Похоже на «${similarity.anchorLabel}» из ваших любимых`);

    // runtime + контекст времени и темпа
    if (title.runtime) {
      let target = profile.runtimeAvg ?? 100;
      if (context.timeAvailable) target = Number(context.timeAvailable);
      const diff = Math.abs(title.runtime - target);
      const runtimeScore = Math.max(0, 1 - diff / Math.max(target, 130));
      signals.runtimeFit = runtimeScore;
      score += runtimeScore * weights.runtime;

      const pace = context.pace ?? 'balanced';
      const paceScore = pace === 'calm' ? (title.runtime > 110 ? 0.4 : 0.15) : pace === 'dynamic' ? (title.runtime < 115 ? 0.35 : 0.1) : 0.2;
      signals.pace = paceScore;
      score += paceScore * weights.contextPace;
      if (runtimeScore > 0.7 && context.timeAvailable) reasons.add('Укладывается во время, которое вы запланировали');
    }

    // настроение, mindset, компания
    const moodBoost = this.mapMoodBoost(context.mood, title.genres ?? []);
    if (moodBoost > 0) {
      signals.mood = moodBoost;
      score += moodBoost * weights.mood;
      reasons.add('Соответствует выбранному настроению');
    }

    const mindsetBoost = this.mapMindsetBoost(context.mindset, ratingScore);
    signals.mindset = mindsetBoost;
    score += mindsetBoost * weights.mindset;

    const companyPenalty = this.companyPenalty(context.company, raw);
    signals.company = companyPenalty;
    score += companyPenalty * weights.company;

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
    const diversity = Math.min(0.4, (title.genres?.length ?? 1) * 0.08 + profile.languageDiversity * 0.01);
    signals.diversity = diversity;
    score += diversity * weights.diversity;

    // анти-лист
    const antiHit = (title.genres ?? []).reduce((acc, g) => acc + (profile.genreNegative[g] ?? 0), 0);
    const antiScore = antiHit ? -Math.min(1.2, antiHit / 3) : 0;
    signals.anti = antiScore;
    score += antiScore * weights.anti;

    return { title, score, signals, reasons: Array.from(reasons) };
  }

  private diversify(items: { title: Title; score: number; signals: Record<string, number>; reasons: string[] }[], limit: number) {
    const picked: typeof items = [];
    const usedGenres = new Set<string>();
    const usedPeople = new Set<string>();

    for (const item of items) {
      if (picked.length >= limit) break;
      const genreOverlap = (item.title.genres ?? []).some((g) => usedGenres.has(g));
      const peopleOverlap = this.extractPeople(item.title).mainPeople.some((p) => usedPeople.has(p));
      if ((genreOverlap || peopleOverlap) && picked.length >= 3) continue;
      picked.push(item);
      item.title.genres?.forEach((g) => usedGenres.add(g));
      this.extractPeople(item.title).mainPeople.forEach((p) => usedPeople.add(p));
    }

    if (picked.length < limit) picked.push(...items.slice(picked.length, limit));
    return picked.slice(0, limit);
  }

  private buildExplanation(
    item: { title: Title; score: number; signals: Record<string, number>; reasons: string[] },
    profile: UserTasteProfile,
    context: RecommendationContext,
  ) {
    const reasons = new Set<string>(item.reasons);
    const year = item.title.releaseDate?.getFullYear();

    if (!reasons.size && item.title.tmdbRating) {
      reasons.add(`Оценка TMDB ${item.title.tmdbRating.toFixed(1)} — выше среднего`);
    }
    if (!reasons.size && year) reasons.add(`Подходит под ваши любимые годы (${year})`);
    if (!reasons.size) reasons.add('Сбалансированное совпадение с вашим профилем вкуса');

    // подсказка про антисписок
    if (profile.genreNegative && Object.keys(profile.genreNegative).length > 0) {
      reasons.add('Мы избегаем ваших стоп-жанров и антисписка');
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
    const cast: string[] = raw?.credits?.cast?.slice(0, 8)?.map((c: any) => c.name)?.filter(Boolean) ?? [];
    const directors: string[] = raw?.credits?.crew?.filter((c: any) => c.job === 'Director')?.map((c: any) => c.name) ?? [];
    const writers: string[] = raw?.credits?.crew?.filter((c: any) => c.department === 'Writing')?.map((c: any) => c.name) ?? [];
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

  private pickVariant(userId: string): WeightVariant {
    const hash = Array.from(userId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return hash % 2 === 0 ? 'A' : 'B';
  }
}
