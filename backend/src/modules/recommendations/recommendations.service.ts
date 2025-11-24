import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  RecommendationEngine,
  RecommendationContext,
  RecommendationSignals,
} from './recommendation.engine';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { RecommendationFeedbackDto } from './dto/feedback.dto';
import { FeedbackContext, TitleStatus, Prisma } from '@prisma/client';
import { pickVariantForUser } from './recommendation.config';
import { inferSignalGroup } from './signals';
import { mapTitleToApi } from '../titles/title.mapper';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: RecommendationEngine,
  ) {}

  private buildContext(userId: string, query: RecommendationQueryDto): {
    context: RecommendationContext;
    variant: string;
  } {
    const limit = query.limit ?? 5;
    void limit; // not used directly here, но limit важен для вызывающих
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay: RecommendationContext['timeOfDay'] =
      query.timeOfDay ??
      (hour < 6 ? 'late_night' : hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening');
    const dayOfWeek: RecommendationContext['dayOfWeek'] =
      query.dayOfWeek ?? (now.getDay() === 0 || now.getDay() === 6 ? 'weekend' : 'weekday');

    const context: RecommendationContext = {
      mood: query.mood,
      mindset: query.mindset,
      company: query.company,
      timeAvailable: query.timeAvailable,
      noveltyBias: query.noveltyBias,
      pace: query.pace,
      freshness: query.freshness,
      timeOfDay,
      dayOfWeek,
      diversityLevel: query.diversityLevel ?? 'balanced',
      overrides: {
        genre: query.overrideGenre,
        mood: query.overrideMood,
        novelty: query.overrideNovelty,
        decade: query.overrideDecade,
        country: query.overrideCountry,
        people: query.overridePeople,
      },
    };
    const variant = pickVariantForUser(userId);
    return { context, variant };
  }

  async getRecommendations(userId: string, query: RecommendationQueryDto) {
    const limit = query.limit ?? 5;
    const { context, variant } = this.buildContext(userId, query);

    const session = await this.prisma.recommendationSession.create({
      data: {
        userId,
        context: { ...context, variant } as Prisma.InputJsonObject,
      },
    });

    const recsRaw = await this.engine.recommend(userId, limit, context);
    const recs = recsRaw.filter(
      (r, idx, arr) => arr.findIndex((i) => i.title.id === r.title.id) === idx,
    );

    const titleIds = recs.map((r) => r.title.id);
    const states = titleIds.length
      ? await this.prisma.userTitleState.findMany({
          where: { userId, titleId: { in: titleIds } },
        })
      : [];
    const stateMap = new Map(states.map((s) => [s.titleId, s]));

    await this.prisma.$transaction(
      recs.map((rec, idx) =>
        this.prisma.recommendationItem.create({
          data: {
            sessionId: session.id,
            titleId: rec.title.id,
            rank: idx + 1,
            score: rec.score,
            signals: this.buildSignalsPayload(rec.signals),
          },
        }),
      ),
    );

    return {
      sessionId: session.id,
      items: recs.map((r) => {
        const state = stateMap.get(r.title.id);
        return {
          title: mapTitleToApi(r.title),
          explanation: r.explanation,
          userState: state
            ? {
                status: state.status,
                liked: state.liked,
                disliked: state.disliked,
              }
            : null,
        };
      }),
    };
  }

  async handleFeedback(userId: string, dto: RecommendationFeedbackDto) {
    // titleId always refers to Title ID from API payload
    const title = await this.prisma.title.findUnique({ where: { id: dto.titleId } });
    const session = await this.prisma.recommendationSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session || !title) throw new NotFoundException('Session or title not found');

    const isLike = dto.feedback === 'like';
    const isDislike = dto.feedback === 'dislike';
    const isWatched = dto.feedback === 'watched';

    await this.prisma.feedbackEvent.create({
      data: {
        userId,
        titleId: title.id,
        value: isLike || isWatched ? 1 : -1,
        context: FeedbackContext.recommendation_card,
        recommendationSessionId: dto.sessionId,
      },
    });

    // Обновляем пользовательский статус / антисписок / историю
    const status =
      isWatched ? TitleStatus.watched : isDislike ? TitleStatus.dropped : TitleStatus.planned;

    await this.prisma.userTitleState.upsert({
      where: { userId_titleId: { userId, titleId: title.id } },
      update: {
        liked: isLike,
        disliked: isDislike,
        status,
        lastInteractionAt: new Date(),
        source: 'recommendation',
      },
      create: {
        userId,
        titleId: title.id,
        liked: isLike,
        disliked: isDislike,
        status,
        source: 'recommendation',
      },
    });

    // Помечаем текущий элемент как заменённый/отработанный, чтобы не рекомендовать его повторно в рамках сессии
    await this.prisma.recommendationItem.updateMany({
      where: { sessionId: dto.sessionId, titleId: title.id },
      data: { replaced: true },
    });

    // Для любого фидбэка (лайк, дизлайк, смотрел) пытаемся подобрать новую, более релевантную замену
    const context = session.context as RecommendationContext;
    const replacement = (await this.engine.recommend(userId, 1, context))[0];
    if (replacement) {
      // Если такой тайтл уже присутствует в текущей сессии, не создаём дубликат (из‑за unique(sessionId,titleId))
      const existingItem = await this.prisma.recommendationItem.findFirst({
        where: { sessionId: session.id, titleId: replacement.title.id },
      });

      const itemId =
        existingItem?.id ??
        (
          await this.prisma.recommendationItem.create({
            data: {
              sessionId: session.id,
              titleId: replacement.title.id,
              rank: 99,
              score: replacement.score,
              signals: this.buildSignalsPayload(replacement.signals),
            },
          })
        ).id;

      return {
        replacement: {
          title: mapTitleToApi(replacement.title),
          explanation: replacement.explanation,
          itemId,
        },
      };
    }

    return { ok: true };
  }

  private buildSignalsPayload(signals: RecommendationSignals) {
    const entries = Object.entries(signals).filter(
      ([, value]) => typeof value === 'number' && !Number.isNaN(value as number),
    );

    const sorted = [...entries].sort(
      (a, b) => Math.abs((b[1] as number) ?? 0) - Math.abs((a[1] as number) ?? 0),
    );
    const topKeys = sorted.slice(0, 12).map(([key]) => key);

    const topGroups = topKeys.reduce<Record<string, number>>((acc, key) => {
      const group = inferSignalGroup(key);
      acc[group] = (acc[group] ?? 0) + 1;
      return acc;
    }, {});

    return {
      values: signals,
      topKeys,
      topGroups,
    };
  }

  async getEveningProgram(userId: string, query: RecommendationQueryDto) {
    const programLimit = 12;
    const { context, variant } = this.buildContext(userId, query);

    const session = await this.prisma.recommendationSession.create({
      data: {
        userId,
        context: { ...context, variant, mode: 'evening_program' } as Prisma.InputJsonObject,
      },
    });

    const recsRaw = await this.engine.recommend(userId, programLimit, context);
    if (!recsRaw.length) {
      return { sessionId: session.id, items: [] };
    }

    const program = this.buildEveningProgram(recsRaw);
    const titleIds = program.map((p) => p.title.id);

    const states = await this.prisma.userTitleState.findMany({
      where: { userId, titleId: { in: titleIds } },
    });
    const stateMap = new Map(states.map((s) => [s.titleId, s]));

    await this.prisma.$transaction(
      program.map((rec, idx) =>
        this.prisma.recommendationItem.create({
          data: {
            sessionId: session.id,
            titleId: rec.title.id,
            rank: idx + 1,
            score: rec.score,
            signals: this.buildSignalsPayload(rec.signals),
          },
        }),
      ),
    );

    return {
      sessionId: session.id,
      items: program.map((p) => {
        const state = stateMap.get(p.title.id);
        return {
          role: p.role,
          title: mapTitleToApi(p.title),
          explanation: p.explanation,
          userState: state
            ? {
                status: state.status,
                liked: state.liked,
                disliked: state.disliked,
              }
            : null,
        };
      }),
    };
  }

  private buildEveningProgram(
    recs: {
      title: any;
      score: number;
      signals: RecommendationSignals;
      explanation: string[];
    }[],
  ): {
    role: 'warmup' | 'main' | 'dessert';
    title: any;
    score: number;
    signals: RecommendationSignals;
    explanation: string[];
  }[] {
    const unique = recs.filter(
      (r, idx, arr) => arr.findIndex((i) => i.title.id === r.title.id) === idx,
    );
    if (!unique.length) return [];

    const main = unique[0];
    const rest = unique.slice(1);

    const mainRuntime = main.title.runtime ?? 110;
    const mainMood = main.signals.mood ?? 0;

    const warmup =
      rest.find((r) => {
        const runtime = r.title.runtime ?? mainRuntime;
        const mood = r.signals.mood ?? mainMood;
        return runtime <= mainRuntime && mood <= mainMood + 0.2;
      }) ?? rest[0] ?? main;

    const usedIds = new Set<string>([main.title.id, warmup.title.id]);

    const dessert =
      rest.find((r) => {
        if (usedIds.has(r.title.id)) return false;
        const runtime = r.title.runtime ?? 90;
        const type = r.title.mediaType;
        const novelty = r.signals.novelty ?? 0;
        return runtime <= 100 || type === 'tv' || type === 'anime' || novelty > 0.3;
      }) ?? main;

    const result = [
      { role: 'warmup' as const, ...warmup },
      { role: 'main' as const, ...main },
      { role: 'dessert' as const, ...dessert },
    ];

    const seen = new Set<string>();
    return result.filter((item) => {
      if (seen.has(item.title.id)) return false;
      seen.add(item.title.id);
      return true;
    });
  }
}
