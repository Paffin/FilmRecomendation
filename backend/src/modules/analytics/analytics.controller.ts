import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  overview(@Req() req: any) {
    return this.service.overview(req.user.userId);
  }

  @Get('taste-map')
  tasteMap(@Req() req: any) {
    return this.service.tasteMap(req.user.userId);
  }

  @Get('history')
  history(@Req() req: any) {
    return this.service.history(req.user.userId);
  }
}
