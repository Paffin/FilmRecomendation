import { Module } from '@nestjs/common';
import { UserTitlesService } from './user-titles.service';
import { UserTitlesController } from './user-titles.controller';
import { TitlesModule } from '../titles/titles.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';

@Module({
  imports: [TitlesModule, RecommendationsModule],
  providers: [UserTitlesService],
  controllers: [UserTitlesController],
  exports: [UserTitlesService],
})
export class UserTitlesModule {}
