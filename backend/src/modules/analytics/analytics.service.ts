import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TitleStatus } from '@prisma/client';

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
    return this.prisma.userTitleState.findMany({
      where: { userId, status: TitleStatus.watched },
      include: { title: true },
      orderBy: { lastInteractionAt: 'desc' },
      take: 200,
    });
  }
}
