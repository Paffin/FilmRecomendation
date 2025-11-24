import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
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

    const tokens = this.generateTokens(user.id, user.email);
    return { user: this.sanitize(user), tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.generateTokens(user.id, user.email);
    return { user: this.sanitize(user), tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      const tokens = this.generateTokens(user.id, user.email);
      return { user: this.sanitize(user), tokens };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
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

    return { accessToken, refreshToken };
  }

  private sanitize(user: { passwordHash: string; [key: string]: any }) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
