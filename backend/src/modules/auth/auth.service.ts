import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AuthService.name);

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
    if (!refreshToken) {
      this.logRefreshFailure('missing_token', undefined, meta);
      throw new UnauthorizedException('Refresh token missing');
    }

    let payload: { sub: string; email: string; exp: number; jti?: string; fid?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch (e) {
      this.logRefreshFailure('invalid_jwt', undefined, meta);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const hashed = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashed } });

    if (!stored || stored.userId !== payload.sub) {
      this.logRefreshFailure('not_found', payload, meta, stored?.familyId);
      if (payload?.sub) await this.revokeAllForUser(payload.sub);
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (stored.revokedAt) {
      this.logRefreshFailure('reuse_revoked', payload, meta, stored.familyId);
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      this.logRefreshFailure('expired', payload, meta, stored.familyId);
      throw new UnauthorizedException('Refresh token expired');
    }

    const hasTrackedJti = stored.jti && stored.jti !== 'legacy';
    if (hasTrackedJti && payload.jti && stored.jti !== payload.jti) {
      this.logRefreshFailure('jti_mismatch', payload, meta, stored.familyId);
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      this.logRefreshFailure('user_not_found', payload, meta, stored.familyId);
      throw new UnauthorizedException('User not found');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { lastUsedAt: new Date() },
    });
    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

    // Выпускаем новый набор токенов, старый оставляем валидным до истечения, но ограничиваем общее число активных
    const session = await this.issueSession(user, meta, stored.familyId);
    await this.trimActiveTokens(user.id, 5);
    return session;
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return { ok: true };
    const hashed = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashed },
      data: { revokedAt: new Date() },
    });
    // при logout можно подчистить старые, но не удаляем все активные, чтобы не трогать параллельные сессии
    await this.trimActiveTokensByUserFromCookie(hashed);
    return { ok: true };
  }

  issueCookiePayload(token: string, expiresAt: Date) {
    const configuredSecure = this.config.get<boolean>('cookies.secure');
    const configuredDomain = this.config.get<string | undefined>('cookies.domain');
    // Browsers reject `Domain=localhost` (and often `127.0.0.1`), which breaks dev refresh cookies.
    // For local/dev we omit the domain so the cookie is host-only and works on localhost:PORT.
    const domain =
      configuredDomain &&
      configuredDomain !== 'localhost' &&
      configuredDomain !== '127.0.0.1' &&
      configuredDomain.trim() !== ''
        ? configuredDomain
        : undefined;
    const frontendUrl = this.config.get<string>('frontendUrl') ?? '';
    const isHttpsFrontend = frontendUrl.startsWith('https://');
    const secure = configuredSecure || isHttpsFrontend;
    // Если secure/https — используем None для кросс-доменных сценариев; иначе уходим в lax
    const sameSite = (secure ? 'none' : (this.config.get<string>('cookies.sameSite') as any)) ?? 'lax';

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

  private async issueSession(user: any, meta: TokenMeta, familyId?: string): Promise<SessionResult> {
    // Retry a couple of times in case of rare token hash collision (unique constraint)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const tokens = this.generateTokens(user.id, user.email, familyId);
      try {
        await this.prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: this.hashToken(tokens.refreshToken),
            expiresAt: tokens.refreshExpiresAt,
            familyId: tokens.familyId,
            jti: tokens.refreshJti,
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
      } catch (e: any) {
        const isUnique = e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('tokenHash');
        if (!isUnique || attempt === 2) {
          throw e;
        }
      }
    }

    // Fallback (should never happen)
    throw new Error('Failed to issue refresh token');
  }

  private generateTokens(userId: string, email: string, familyId?: string) {
    const accessExpiresIn = this.config.get<string>('jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshJti = crypto.randomUUID();
    const family = familyId ?? crypto.randomUUID();

    const accessToken = this.jwt.sign(
      { sub: userId, email, jti: crypto.randomUUID() },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn: accessExpiresIn },
    );

    const refreshToken = this.jwt.sign(
      { sub: userId, email, jti: refreshJti, fid: family },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshExpiresIn },
    );

    const decoded = this.jwt.decode(refreshToken) as any;
    const refreshExpiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return { accessToken, refreshToken, refreshExpiresAt, refreshJti, familyId: family };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async trimActiveTokens(userId: string, maxCount: number) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (tokens.length <= maxCount) return;
    const toDelete = tokens.slice(maxCount);
    await this.prisma.refreshToken.updateMany({
      where: { id: { in: toDelete.map((t) => t.id) } },
      data: { revokedAt: new Date() },
    });
  }

  private async trimActiveTokensByUserFromCookie(currentHash: string) {
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: currentHash } });
    if (!token) return;
    await this.trimActiveTokens(token.userId, 5);
  }

  private async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private logRefreshFailure(
    reason: string,
    payload: { sub?: string; jti?: string } | undefined,
    meta: TokenMeta,
    familyId?: string,
  ) {
    this.logger.warn(
      `[auth.refresh] ${reason} user=${payload?.sub ?? 'unknown'} jti=${payload?.jti ?? 'n/a'} family=${familyId ?? 'n/a'} ip=${meta.ip ?? '-'} ua=${(meta.userAgent ?? '').slice(0, 140)}`,
    );
  }

  private sanitize(user: { passwordHash: string; [key: string]: any }) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
