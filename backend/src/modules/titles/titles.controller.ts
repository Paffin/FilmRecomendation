import { Controller, Get, Param, Query } from '@nestjs/common';
import { TitlesService } from './titles.service';
import { MediaType } from '@prisma/client';
import { mapTitleToApi } from './title.mapper';

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
  async findByTmdb(
    @Param('tmdbId') tmdbId: string,
    @Query('mediaType') mediaType: MediaType,
  ) {
    const title = await this.service.getOrCreateFromTmdb(Number(tmdbId), mediaType);
    return mapTitleToApi(title);
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
  async findOne(@Param('id') id: string) {
    const title = await this.service.findOne(id);
    return mapTitleToApi(title);
  }

  @Get(':id/trailer')
  trailer(@Param('id') id: string) {
    return this.service.getTrailerForTitle(id);
  }

  @Get(':id/similar')
  similar(@Param('id') id: string, @Query('page') page = '1') {
    return this.service.findSimilar(id, Number(page) || 1);
  }
}
