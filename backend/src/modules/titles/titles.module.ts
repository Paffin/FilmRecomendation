import { Module } from '@nestjs/common';
import { TitlesService } from './titles.service';
import { TitlesController } from './titles.controller';
import { TmdbModule } from '../tmdb/tmdb.module';

@Module({
  imports: [TmdbModule],
  controllers: [TitlesController],
  providers: [TitlesService],
  exports: [TitlesService],
})
export class TitlesModule {}
