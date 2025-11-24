import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface TokenMeta {
  userAgent?: string;
  ip?: string;
}

interface SessionResult {
  user: any;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: TokenMeta): Promise<SessionResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
      },
    });

    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta: TokenMeta): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    return this.issueSession(user, meta);
  }

  async refresh(refreshToken: string | undefined, meta: TokenMeta): Promise<SessionResult> {
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

    let payload: { sub: string; email: string; exp: number };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const hashed = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashed } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    await this.prisma.refreshToken.update({
      where: { tokenHash: hashed },
      data: { revokedAt: new Date() },
    });

    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

    return this.issueSession(user, meta);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return { ok: true };
    const hashed = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: hashed }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  issueCookiePayload(token: string, expiresAt: Date) {
    const secure = this.config.get<boolean>('cookies.secure');
    const domain = this.config.get<string | undefined>('cookies.domain');
    const sameSite = (this.config.get<string>('cookies.sameSite') as any) ?? 'lax';

    return {
      name: 'refresh_token',
      value: token,
      options: {
        httpOnly: true,
        secure,
        domain,
        sameSite,
        path: '/api/auth',
        maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
      },
    } as const;
  }

  private async issueSession(user: any, meta: TokenMeta): Promise<SessionResult> {
    const tokens = this.generateTokens(user.id, user.email);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: tokens.refreshExpiresAt,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        ip: meta.ip ?? null,
      },
    });

    return {
      user: this.sanitize(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }

  private generateTokens(userId: string, email: string) {
    const accessExpiresIn = this.config.get<string>('jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';

    const accessToken = this.jwt.sign(
      { sub: userId, email },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn: accessExpiresIn },
    );

    const refreshToken = this.jwt.sign(
      { sub: userId, email },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshExpiresIn },
    );

    const decoded = this.jwt.decode(refreshToken) as any;
    const refreshExpiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private sanitize(user: { passwordHash: string; [key: string]: any }) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
