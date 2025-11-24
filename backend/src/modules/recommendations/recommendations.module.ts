import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationEngine } from './recommendation.engine';
import { TitlesModule } from '../titles/titles.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { RecommendationCatalogTasks } from './recommendation.tasks';

@Module({
  imports: [TitlesModule, TmdbModule],
  providers: [RecommendationsService, RecommendationEngine, RecommendationCatalogTasks],
  controllers: [RecommendationsController],
})
export class RecommendationsModule {}
