import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TitlesService } from '../titles/titles.service';
import { CreateUserTitleDto } from './dto/create-user-title.dto';
import { UpdateUserTitleDto } from './dto/update-user-title.dto';
import { MediaType, TitleStatus } from '@prisma/client';
import { mapUserTitleStateToApi } from './user-titles.mapper';

@Injectable()
export class UserTitlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly titles: TitlesService,
  ) {}

  async list(userId: string, status?: TitleStatus, mediaType?: MediaType) {
    const rows = await this.prisma.userTitleState.findMany({
      where: {
        userId,
        status,
        title: mediaType ? { mediaType } : undefined,
      },
      include: { title: true },
      orderBy: { lastInteractionAt: 'desc' },
    });
    return rows.map((row) => mapUserTitleStateToApi(row));
  }

  async findByTitle(userId: string, titleId: string) {
    const state = await this.prisma.userTitleState.findUnique({
      where: { userId_titleId: { userId, titleId } },
      include: { title: true },
    });
    return state ? mapUserTitleStateToApi(state) : null;
  }

  async create(userId: string, dto: CreateUserTitleDto) {
    const title = await this.titles.getOrCreateFromTmdb(dto.tmdbId, dto.mediaType);
    const state = await this.prisma.userTitleState.upsert({
      where: { userId_titleId: { userId, titleId: title.id } },
      update: {
        status: dto.status,
        liked: dto.liked ?? false,
        disliked: dto.disliked ?? false,
        rating: dto.rating,
        source: dto.source,
        lastInteractionAt: new Date(),
      },
      create: {
        userId,
        titleId: title.id,
        status: dto.status,
        liked: dto.liked ?? false,
        disliked: dto.disliked ?? false,
        rating: dto.rating,
        source: dto.source ?? 'manual',
      },
      include: { title: true },
    });
    return mapUserTitleStateToApi(state);
  }

  async update(userId: string, id: string, dto: UpdateUserTitleDto) {
    const existing = await this.prisma.userTitleState.findUnique({
      where: { id },
      include: { title: true },
    });
    if (!existing) throw new NotFoundException('User title state not found');
    if (existing.userId !== userId) throw new ForbiddenException();

    const state = await this.prisma.userTitleState.update({
      where: { id },
      data: {
        status: dto.status ?? existing.status,
        liked: dto.liked ?? existing.liked,
        disliked: dto.disliked ?? existing.disliked,
        rating: dto.rating ?? existing.rating,
        source: dto.source ?? existing.source,
        lastInteractionAt: new Date(),
      },
      include: { title: true },
    });
    return mapUserTitleStateToApi(state);
  }
}
