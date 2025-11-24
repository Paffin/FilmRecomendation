import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.feedbackEvent.findMany({
      where: { userId },
      include: { title: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
