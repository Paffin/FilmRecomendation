import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { RecommendationFeedbackDto } from './dto/feedback.dto';
import { RecommendationTweakDto } from './dto/tweak.dto';
import { WhyNotDto } from './dto/why-not.dto';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}

  @Get()
  get(@Req() req: any, @Query() query: RecommendationQueryDto) {
    return this.service.getRecommendations(req.user.userId, query);
  }

  @Get('evening-program')
  getEveningProgram(@Req() req: any, @Query() query: RecommendationQueryDto) {
    return this.service.getEveningProgram(req.user.userId, query);
  }

  @Post('feedback')
  feedback(@Req() req: any, @Body() dto: RecommendationFeedbackDto) {
    return this.service.handleFeedback(req.user.userId, dto);
  }

  @Post('tweak')
  tweak(@Req() req: any, @Body() dto: RecommendationTweakDto) {
    return this.service.applyTweak(req.user.userId, dto);
  }

  @Post('why-not')
  whyNot(@Req() req: any, @Body() dto: WhyNotDto) {
    return this.service.getWhyNot(req.user.userId, dto);
  }
}
