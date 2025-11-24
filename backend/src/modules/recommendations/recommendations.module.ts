import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationEngine } from './recommendation.engine';
import { TitlesModule } from '../titles/titles.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { RecommendationCatalogTasks } from './recommendation.tasks';
import { RecommendationExperimentService } from './experiment.service';

@Module({
  imports: [TitlesModule, TmdbModule],
  providers: [
    RecommendationsService,
    RecommendationEngine,
    RecommendationCatalogTasks,
    RecommendationExperimentService,
  ],
  controllers: [RecommendationsController],
  exports: [RecommendationEngine, RecommendationExperimentService],
})
export class RecommendationsModule {}
