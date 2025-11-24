import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TitleStatus } from '@prisma/client';
import { mapUserTitleStateToApi } from '../user-titles/user-titles.mapper';

type TasteGalaxyNodeKind = 'user' | 'genre' | 'title';

interface TasteGalaxyNode {
  id: string;
  kind: TasteGalaxyNodeKind;
  label: string;
  weight: number;
  meta?: {
    mediaType?: string;
    tmdbRating?: number | null;
    year?: number | null;
    posterPath?: string | null;
  };
}

type TasteGalaxyEdgeKind = 'preference' | 'belongs_to' | 'similar';

interface TasteGalaxyEdge {
  source: string;
  target: string;
  kind: TasteGalaxyEdgeKind;
  strength: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const states = await this.prisma.userTitleState.findMany({
      where: { userId },
      include: { title: true },
    });

    const watched = states.filter((s) => s.status === TitleStatus.watched);
    const liked = states.filter((s) => s.liked);
    const planned = states.filter((s) => s.status === TitleStatus.planned);

    const totalRuntimeMinutes = watched.reduce((acc, item) => acc + (item.title.runtime ?? 0), 0);
    const byType = watched.reduce<Record<string, number>>((acc, item) => {
      acc[item.title.mediaType] = (acc[item.title.mediaType] ?? 0) + 1;
      return acc;
    }, {});

    const genreCounter: Record<string, number> = {};
    const countryCounter: Record<string, number> = {};
    let ratingSum = 0;
    let ratingCount = 0;
    watched.forEach((item) => {
      item.title.genres?.forEach((g) => (genreCounter[g] = (genreCounter[g] ?? 0) + 1));
      item.title.countries?.forEach((c) => (countryCounter[c] = (countryCounter[c] ?? 0) + 1));
      if (item.rating) {
        ratingSum += item.rating;
        ratingCount += 1;
      }
    });

    const topGenre = Object.entries(genreCounter).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCountry = Object.entries(countryCounter).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      watchedCount: watched.length,
      likedCount: liked.length,
      plannedCount: planned.length,
      totalRuntimeHours: Math.round((totalRuntimeMinutes / 60) * 10) / 10,
      byType,
      topGenre: topGenre ?? null,
      topCountry: topCountry ?? null,
      averageRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    };
  }

  async tasteMap(userId: string) {
    const watched = await this.prisma.userTitleState.findMany({
      where: { userId, status: TitleStatus.watched },
      include: { title: true },
    });

    const disliked = await this.prisma.userTitleState.findMany({
      where: { userId, disliked: true },
      include: { title: true },
      take: 30,
    });

    const genreCounter: Record<string, number> = {};
    const countryCounter: Record<string, number> = {};
    const years: number[] = [];
    const decades: Record<string, number> = {};

    watched.forEach((item) => {
      item.title.genres?.forEach((g) => {
        genreCounter[g] = (genreCounter[g] ?? 0) + 1;
      });
      item.title.countries?.forEach((c) => {
        countryCounter[c] = (countryCounter[c] ?? 0) + 1;
      });
      const year = item.title.releaseDate?.getFullYear();
      if (year) {
        years.push(year);
        const decade = Math.floor(year / 10) * 10;
        decades[String(decade)] = (decades[String(decade)] ?? 0) + 1;
      }
    });

    return {
      genres: genreCounter,
      countries: countryCounter,
      years,
      decades,
      antiList: disliked.map((d) => ({
        id: d.title.id,
        title: d.title.russianTitle ?? d.title.originalTitle,
      })),
    };
  }

  async tasteGalaxy(userId: string): Promise<{
    nodes: TasteGalaxyNode[];
    edges: TasteGalaxyEdge[];
  }> {
    const states = await this.prisma.userTitleState.findMany({
      where: { userId },
      include: { title: true },
    });

    if (!states.length) {
      return { nodes: [], edges: [] };
    }

    const userNodeId = `user:${userId}`;
    const nodes: TasteGalaxyNode[] = [
      {
        id: userNodeId,
        kind: 'user',
        label: 'Вы',
        weight: 1,
      },
    ];

    const genreAgg: Record<
      string,
      {
        weight: number;
        count: number;
      }
    > = {};

    states.forEach((state) => {
      const base =
        state.liked || state.rating
          ? 2
          : state.status === TitleStatus.watched
            ? 1
            : 0.5;
      const sign = state.disliked ? -1 : 1;
      const w = base * sign;
      state.title.genres?.forEach((g) => {
        if (!genreAgg[g]) {
          genreAgg[g] = { weight: 0, count: 0 };
        }
        genreAgg[g].weight += w;
        genreAgg[g].count += 1;
      });
    });

    const topGenres = Object.entries(genreAgg)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 6);

    const edges: TasteGalaxyEdge[] = [];

    topGenres.forEach(([genre, stats]) => {
      const nodeId = `genre:${genre}`;
      nodes.push({
        id: nodeId,
        kind: 'genre',
        label: genre,
        weight: stats.weight,
      });
      const strength = Math.max(0.1, Math.min(1, stats.weight / (states.length || 1)));
      edges.push({
        source: userNodeId,
        target: nodeId,
        kind: 'preference',
        strength,
      });
    });

    const titleNodesById = new Map<string, TasteGalaxyNode>();
    const genreIds = new Set(topGenres.map(([g]) => g));

    topGenres.forEach(([genre]) => {
      const genreNodeId = `genre:${genre}`;
      const genreStates = states
        .filter((s) => s.title.genres?.includes(genre))
        .slice(0);

      const scored = genreStates
        .map((s) => {
          const liked = s.liked;
          const disliked = s.disliked;
          const rating = s.rating ?? s.title.tmdbRating ?? 0;
          const score =
            (liked ? 3 : 0) + (disliked ? -3 : 0) + rating / 2 + (s.status === TitleStatus.watched ? 1 : 0);
          return { state: s, score };
        })
        .sort((a, b) => b.score - a.score);

      scored.slice(0, 6).forEach(({ state, score }) => {
        const title = state.title;
        const nodeId = `title:${title.id}`;
        if (!titleNodesById.has(nodeId)) {
          const year = title.releaseDate?.getFullYear() ?? null;
          titleNodesById.set(nodeId, {
            id: nodeId,
            kind: 'title',
            label: title.russianTitle ?? title.originalTitle,
            weight: score,
            meta: {
              mediaType: title.mediaType,
              tmdbRating: title.tmdbRating ?? null,
              year,
              posterPath: title.posterPath ?? null,
            },
          });
        }

        edges.push({
          source: genreNodeId,
          target: nodeId,
          kind: 'belongs_to',
          strength: 0.8,
        });
      });
    });

    // Дополнительные связи «похожие тайтлы» по пересечению жанров
    const titleNodes = Array.from(titleNodesById.values());
    for (let i = 0; i < titleNodes.length; i += 1) {
      for (let j = i + 1; j < titleNodes.length; j += 1) {
        const a = titleNodes[i];
        const b = titleNodes[j];
        const aId = a.id.replace('title:', '');
        const bId = b.id.replace('title:', '');
        const aState = states.find((s) => s.title.id === aId);
        const bState = states.find((s) => s.title.id === bId);
        if (!aState || !bState) continue;
        const genresA = (aState.title.genres ?? []).filter((g) => genreIds.has(g));
        const genresB = (bState.title.genres ?? []).filter((g) => genreIds.has(g));
        if (!genresA.length || !genresB.length) continue;
        const intersection = genresA.filter((g) => genresB.includes(g)).length;
        const union = new Set([...genresA, ...genresB]).size || 1;
        const jaccard = intersection / union;
        if (jaccard >= 0.5) {
          edges.push({
            source: a.id,
            target: b.id,
            kind: 'similar',
            strength: jaccard,
          });
        }
      }
    }

    nodes.push(...titleNodes);

    return { nodes, edges };
  }

  async history(userId: string) {
    const rows = await this.prisma.userTitleState.findMany({
      where: { userId, status: TitleStatus.watched },
      include: { title: true },
      orderBy: { lastInteractionAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => mapUserTitleStateToApi(row));
  }

  async contextPresets(userId: string) {
    const events = await this.prisma.feedbackEvent.findMany({
      where: {
        userId,
        value: { gt: 0 },
        recommendationSessionId: { not: null },
      },
      include: { recommendationSession: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const map = new Map<
      string,
      {
        context: any;
        score: number;
        lastUsedAt: Date;
      }
    >();

    for (const ev of events) {
      const session = ev.recommendationSession;
      if (!session) continue;
      const ctx = (session.context ?? {}) as any;
      const key = [
        ctx.mood ?? '',
        ctx.mindset ?? '',
        ctx.company ?? '',
        ctx.timeAvailable ?? '',
        ctx.noveltyBias ?? '',
        ctx.pace ?? '',
        ctx.freshness ?? '',
      ].join('|');

      const existing = map.get(key);
      if (existing) {
        existing.score += ev.value;
        if (ev.createdAt > existing.lastUsedAt) existing.lastUsedAt = ev.createdAt;
      } else {
        map.set(key, {
          context: ctx,
          score: ev.value,
          lastUsedAt: ev.createdAt,
        });
      }
    }

    const presets = Array.from(map.values())
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score || b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
      .slice(0, 5)
      .map((p, idx) => {
        const ctx = p.context ?? {};
        return {
          id: `preset-${idx}`,
          label: this.buildContextPresetLabel(ctx),
          mood: ctx.mood ?? null,
          mindset: ctx.mindset ?? null,
          company: ctx.company ?? null,
          timeAvailable: ctx.timeAvailable ?? null,
          noveltyBias: ctx.noveltyBias ?? null,
          pace: ctx.pace ?? null,
          freshness: ctx.freshness ?? null,
        };
      });

    return presets;
  }

  private buildContextPresetLabel(ctx: any): string {
    const company = ctx.company as string | undefined;
    const timeAvailable = ctx.timeAvailable as string | undefined;
    const novelty = ctx.noveltyBias as string | undefined;
    const pace = ctx.pace as string | undefined;
    const mood = ctx.mood as string | undefined;

    if (company === 'family') {
      if (timeAvailable && Number(timeAvailable) >= 90) {
        return 'Семейный вечер с длинным фильмом';
      }
      return 'Быстрый семейный просмотр';
    }

    if (company === 'friends') {
      return novelty === 'surprise'
        ? 'Вечер с друзьями и экспериментами'
        : 'Комфортный вечер с друзьями';
    }

    if (company === 'duo') {
      return 'Вечер вдвоём';
    }

    if (company === 'solo') {
      if (mood === 'light') return 'Лёгкий соло‑вечер';
      if (mood === 'heavy') return 'Настроение для серьёзного кино';
      return 'Соло‑просмотр без привязки к жанру';
    }

    if (pace === 'dynamic') return 'Динамичный вечер с бодрым темпом';
    if (novelty === 'surprise') return 'Вечер открытий и сюрпризов';

    return 'Ваш часто используемый режим вечера';
  }
}
