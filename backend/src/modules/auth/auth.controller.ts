import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.service.register(dto, this.meta(req));
    this.setCookie(res, session.refreshToken, session.refreshExpiresAt);
    return { user: session.user, tokens: { accessToken: session.accessToken } };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.service.login(dto, this.meta(req));
    this.setCookie(res, session.refreshToken, session.refreshExpiresAt);
    return { user: session.user, tokens: { accessToken: session.accessToken } };
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = dto.refreshToken ?? (req.cookies ? req.cookies['refresh_token'] : undefined);
    const session = await this.service.refresh(token, this.meta(req));
    this.setCookie(res, session.refreshToken, session.refreshExpiresAt);
    return { user: session.user, tokens: { accessToken: session.accessToken } };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies ? req.cookies['refresh_token'] : undefined;
    await this.service.logout(token);
    const cookieConfig = this.service.issueCookiePayload('', new Date());
    res.clearCookie(cookieConfig.name, {
      path: cookieConfig.options.path,
      domain: cookieConfig.options.domain,
      secure: cookieConfig.options.secure,
      sameSite: cookieConfig.options.sameSite,
    });
    return { ok: true };
  }

  private meta(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip ?? req.socket.remoteAddress };
  }

  private setCookie(res: Response, token: string, expiresAt: Date) {
    const payload = this.service.issueCookiePayload(token, expiresAt);
    res.cookie(payload.name, payload.value, payload.options);
  }
}
