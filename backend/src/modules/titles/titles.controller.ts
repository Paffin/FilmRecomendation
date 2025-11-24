import { Controller, Get, Param, Query } from '@nestjs/common';
import { TitlesService } from './titles.service';
import { MediaType } from '@prisma/client';

@Controller('titles')
export class TitlesController {
  constructor(private readonly service: TitlesService) {}

  @Get('discover')
  discover(
    @Query('page') page = '1',
    @Query('mediaType') mediaType?: MediaType,
  ) {
    return this.service.discover(Number(page) || 1, mediaType);
  }

  @Get('tmdb/:tmdbId')
  findByTmdb(@Param('tmdbId') tmdbId: string, @Query('mediaType') mediaType: MediaType) {
    return this.service.getOrCreateFromTmdb(Number(tmdbId), mediaType);
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('mediaType') mediaType?: MediaType,
  ) {
    return this.service.search(q, Number(page) || 1, mediaType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/similar')
  similar(@Param('id') id: string, @Query('page') page = '1') {
    return this.service.findSimilar(id, Number(page) || 1);
  }
}
