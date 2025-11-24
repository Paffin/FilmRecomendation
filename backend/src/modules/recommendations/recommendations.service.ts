import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RecommendationEngine, RecommendationContext } from './recommendation.engine';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { RecommendationFeedbackDto } from './dto/feedback.dto';
import { FeedbackContext, TitleStatus, Prisma } from '@prisma/client';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: RecommendationEngine,
  ) {}

  async getRecommendations(userId: string, query: RecommendationQueryDto) {
    const limit = query.limit ?? 5;
    const context: RecommendationContext = {
      mood: query.mood,
      mindset: query.mindset,
      company: query.company,
      timeAvailable: query.timeAvailable,
      noveltyBias: query.noveltyBias,
      pace: query.pace,
      freshness: query.freshness,
    };

    const session = await this.prisma.recommendationSession.create({
      data: {
        userId,
        context: context as Prisma.InputJsonObject,
      },
    });

    const recsRaw = await this.engine.recommend(userId, limit, context);
    const recs = recsRaw.filter(
      (r, idx, arr) => arr.findIndex((i) => i.title.id === r.title.id) === idx,
    );

    await this.prisma.$transaction(
      recs.map((rec, idx) =>
        this.prisma.recommendationItem.create({
          data: {
            sessionId: session.id,
            titleId: rec.title.id,
            rank: idx + 1,
            score: rec.score,
            signals: rec.signals,
          },
        }),
      ),
    );

    return {
      sessionId: session.id,
      items: recs.map((r) => ({ title: r.title, explanation: r.explanation })),
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
              signals: replacement.signals,
            },
          })
        ).id;

      return {
        replacement: {
          title: replacement.title,
          explanation: replacement.explanation,
          itemId,
        },
      };
    }

    return { ok: true };
  }
}
