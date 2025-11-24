import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export type ExperimentDiversityLevel = 'soft' | 'balanced' | 'bold';
export type ExperimentNoveltyBias = 'safe' | 'mix' | 'surprise';

export interface ExperimentVariantConfig {
  diversityLevel?: ExperimentDiversityLevel;
  noveltyBias?: ExperimentNoveltyBias;
}

export interface ExperimentAssignment {
  experimentKey: string;
  variantKey: string;
  config: ExperimentVariantConfig;
}

interface RawExperimentConfig {
  variants?: Record<string, ExperimentVariantConfig>;
}

@Injectable()
export class RecommendationExperimentService {
  private readonly logger = new Logger(RecommendationExperimentService.name);
  private readonly defaultExperimentKey =
    process.env.RECOMMENDATION_EXPERIMENT_KEY ?? 'main';

  constructor(private readonly prisma: PrismaService) {}

  async getAssignment(userId: string): Promise<ExperimentAssignment | null> {
    const experiment = await this.prisma.recommendationExperiment.findUnique({
      where: { key: this.defaultExperimentKey },
    });

    if (!experiment || !experiment.isActive) {
      return null;
    }

    const config = this.normalizeConfig(experiment.config as RawExperimentConfig | null);
    const variantKeys = Object.keys(config.variants);
    if (!variantKeys.length) {
      return null;
    }

    let assignment = await this.prisma.userExperimentAssignment.findFirst({
      where: { userId, experimentId: experiment.id },
    });

    if (!assignment) {
      const variantKey =
        variantKeys.length === 1
          ? variantKeys[0]
          : this.assignVariantKey(userId, experiment.key, variantKeys);

      assignment = await this.prisma.userExperimentAssignment.create({
        data: {
          userId,
          experimentId: experiment.id,
          variantKey,
        },
      });
    }

    const variantConfig = config.variants[assignment.variantKey] ?? {};

    return {
      experimentKey: experiment.key,
      variantKey: assignment.variantKey,
      config: variantConfig,
    };
  }

  private assignVariantKey(
    userId: string,
    experimentKey: string,
    variantKeys: string[],
  ): string {
    const hashSource = `${experimentKey}:${userId}`;
    const hash = Array.from(hashSource).reduce(
      (acc, ch) => acc + ch.charCodeAt(0),
      0,
    );
    const idx = Math.abs(hash) % variantKeys.length;
    return variantKeys[idx];
  }

  private normalizeConfig(
    raw: RawExperimentConfig | null,
  ): { variants: Record<string, ExperimentVariantConfig> } {
    if (!raw || typeof raw !== 'object') {
      return {
        variants: {
          control: {},
        },
      };
    }

    if (raw.variants && typeof raw.variants === 'object') {
      return {
        variants: raw.variants,
      };
    }

    this.logger.warn(
      'Invalid recommendation experiment config, falling back to single control variant',
    );
    return {
      variants: {
        control: {},
      },
    };
  }
}

