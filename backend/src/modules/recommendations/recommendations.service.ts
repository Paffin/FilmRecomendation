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
    // if titleId refers to Title rather than item ID, adjust search
    const title = await this.prisma.title.findUnique({ where: { id: dto.titleId } });
    const session = await this.prisma.recommendationSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session || !title) throw new NotFoundException('Session or title not found');

    await this.prisma.feedbackEvent.create({
      data: {
        userId,
        titleId: title.id,
        value: dto.feedback === 'like' ? 1 : -1,
        context: FeedbackContext.recommendation_card,
        recommendationSessionId: dto.sessionId,
      },
    });

    // Обновляем пользовательский статус / антисписок
    await this.prisma.userTitleState.upsert({
      where: { userId_titleId: { userId, titleId: title.id } },
      update: {
        liked: dto.feedback === 'like',
        disliked: dto.feedback === 'dislike',
        status: dto.feedback === 'dislike' ? TitleStatus.dropped : TitleStatus.planned,
        lastInteractionAt: new Date(),
        source: 'recommendation',
      },
      create: {
        userId,
        titleId: title.id,
        liked: dto.feedback === 'like',
        disliked: dto.feedback === 'dislike',
        status: dto.feedback === 'dislike' ? TitleStatus.dropped : TitleStatus.planned,
        source: 'recommendation',
      },
    });

    if (dto.feedback === 'dislike') {
      await this.prisma.recommendationItem.updateMany({
        where: { sessionId: dto.sessionId, titleId: title.id },
        data: { replaced: true },
      });

      const context = session.context as RecommendationContext;
      const replacement = (await this.engine.recommend(userId, 1, context))[0];
      if (replacement) {
        const created = await this.prisma.recommendationItem.create({
          data: {
            sessionId: session.id,
            titleId: replacement.title.id,
            rank: 99,
            score: replacement.score,
            signals: replacement.signals,
          },
        });
        return {
          replacement: {
            title: replacement.title,
            explanation: replacement.explanation,
            itemId: created.id,
          },
        };
      }
    }

    return { ok: true };
  }
}
