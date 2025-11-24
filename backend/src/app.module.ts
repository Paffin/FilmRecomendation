import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TmdbModule } from './modules/tmdb/tmdb.module';
import { TitlesModule } from './modules/titles/titles.module';
import { UserTitlesModule } from './modules/user-titles/user-titles.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TmdbModule,
    TitlesModule,
    UserTitlesModule,
    RecommendationsModule,
    FeedbackModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
