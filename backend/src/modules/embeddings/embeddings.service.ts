import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../common/prisma.service';
import { Title } from '@prisma/client';

type Vector = number[];

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly endpoint?: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly dimension = 384;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.endpoint = this.config.get<string>('embedding.endpoint');
    this.apiKey = this.config.get<string>('embedding.apiKey');
    this.model = this.config.get<string>('embedding.model') ?? 'intfloat/multilingual-e5-base';
  }

  async ensureTitleEmbedding(title: Title, langHint?: string) {
    const existing = await this.prisma.titleEmbedding.findUnique({ where: { titleId: title.id } });
    if (existing) return existing;

    const textParts = [title.russianTitle, title.originalTitle, title.overview, (title.genres ?? []).join(', ')].filter(
      Boolean,
    );
    const text = textParts.join(' • ').slice(0, 2000);
    const embedding = await this.generateEmbedding(text, langHint ?? title.originalLanguage ?? 'ru');
    if (!embedding) return null;

    try {
      return await this.prisma.titleEmbedding.upsert({
        where: { titleId: title.id },
        create: {
          titleId: title.id,
          embedding,
          model: this.model,
          language: langHint ?? title.originalLanguage ?? 'unknown',
        },
        update: {
          embedding,
          model: this.model,
          language: langHint ?? title.originalLanguage ?? 'unknown',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to store embedding for title ${title.id}: ${(error as Error).message}`);
      return null;
    }
  }

  async getEmbedding(titleId: string): Promise<Vector | null> {
    const row = await this.prisma.titleEmbedding.findUnique({ where: { titleId } });
    return (row?.embedding as Vector | undefined) ?? null;
  }

  async searchSimilar(vector: Vector, limit: number, excludeIds: Set<string> = new Set()) {
    if (!vector?.length) return [];
    const rows = await this.prisma.titleEmbedding.findMany({
      where: { titleId: { notIn: Array.from(excludeIds) } },
      take: Math.max(limit * 4, 80),
    });

    const scored = rows
      .map((row) => {
        const emb = row.embedding as Vector;
        const sim = this.cosineSimilarity(vector, emb);
        return { titleId: row.titleId, score: sim };
      })
      .filter((x) => Number.isFinite(x.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 2);

    if (!scored.length) return [];
    const ids = scored.map((s) => s.titleId);
    const titles = await this.prisma.title.findMany({ where: { id: { in: ids } } });
    const map = new Map(titles.map((t) => [t.id, t]));
    return scored
      .map((s) => map.get(s.titleId))
      .filter((t): t is Title => Boolean(t))
      .slice(0, limit);
  }

  private async generateEmbedding(text: string, language: string): Promise<Vector | null> {
    // 1) Try external embedding service if configured.
    if (this.endpoint) {
      try {
        const { data } = await axios.post(
          this.endpoint,
          { text, language, model: this.model },
          { headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined, timeout: 4500 },
        );
        const vector: number[] | undefined = data?.embedding ?? data?.vector ?? data?.data;
        if (Array.isArray(vector) && vector.length > 0) {
          return this.normalize(vector);
        }
      } catch (error) {
        this.logger.warn(`Embedding endpoint failed, fallback to local hash: ${(error as Error).message}`);
      }
    }

    // 2) Lightweight deterministic hash-based embedding as fallback (non-ML, но даёт стабильный вектор).
    const vec = new Array(this.dimension).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const idx = code % this.dimension;
      vec[idx] += ((code % 29) - 14) / 50;
    }
    return this.normalize(vec);
  }

  private normalize(vector: number[]): Vector {
    const len = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0) || 1);
    return vector.map((v) => Number((v / len).toFixed(6)));
  }

  private cosineSimilarity(a: Vector, b: Vector): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA || 1) * Math.sqrt(normB || 1);
    return denom === 0 ? 0 : dot / denom;
  }
}
