import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TitleStatus } from '@prisma/client';
import { mapUserTitleStateToApi } from '../user-titles/user-titles.mapper';

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
