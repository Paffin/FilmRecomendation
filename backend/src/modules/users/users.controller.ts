import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.service.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/complete')
  completeOnboarding(@Req() req: any) {
    return this.service.completeOnboarding(req.user.userId);
  }
}
