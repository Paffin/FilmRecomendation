import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserTitlesService } from './user-titles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserTitleDto } from './dto/create-user-title.dto';
import { UpdateUserTitleDto } from './dto/update-user-title.dto';
import { MediaType, TitleStatus } from '@prisma/client';

@Controller('user-titles')
@UseGuards(JwtAuthGuard)
export class UserTitlesController {
  constructor(private readonly service: UserTitlesService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('status') status?: TitleStatus,
    @Query('mediaType') mediaType?: MediaType,
  ) {
    return this.service.list(req.user.userId, status, mediaType);
  }

  @Get('title/:titleId')
  findForTitle(@Req() req: any, @Param('titleId') titleId: string) {
    return this.service.findByTitle(req.user.userId, titleId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateUserTitleDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserTitleDto) {
    return this.service.update(req.user.userId, id, dto);
  }
}
