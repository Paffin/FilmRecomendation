import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthModule } from '../src/modules/auth/auth.module';
import { PrismaService } from '../src/common/prisma.service';
import { PrismaModule } from '../src/common/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

const users: any[] = [];
const refreshTokens: any[] = [];

const prismaStub: Partial<PrismaService> = {
  user: {
    findUnique: async ({ where }: any) => users.find((u) => u.id === where.id || u.email === where.email) ?? null,
    create: async ({ data }: any) => {
      const user = {
        ...data,
        id: data.id ?? `user-${users.length + 1}`,
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
      return user;
    },
  } as any,
  refreshToken: {
    findUnique: async ({ where }: any) => refreshTokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
    findMany: async ({ where }: any) => {
      let items = [...refreshTokens];
      if (where?.userId) {
        items = items.filter((t) => t.userId === where.userId);
      }
      if (where?.revokedAt === null) {
        items = items.filter((t) => t.revokedAt == null);
      }
      if (where?.expiresAt?.gt) {
        const gt = where.expiresAt.gt as Date;
        items = items.filter((t) => t.expiresAt > gt);
      }
      // emulate ordering by lastUsedAt desc, createdAt desc
      items.sort((a, b) => {
        const luA = (a.lastUsedAt as Date) ?? (a.createdAt as Date);
        const luB = (b.lastUsedAt as Date) ?? (b.createdAt as Date);
        return luB.getTime() - luA.getTime();
      });
      return items;
    },
    create: async ({ data }: any) => {
      const token = { ...data, id: data.id ?? `rt-${refreshTokens.length + 1}`, createdAt: new Date(), revokedAt: null };
      refreshTokens.push(token);
      return token;
    },
    update: async ({ where, data }: any) => {
      const token = refreshTokens.find((t) => t.tokenHash === where.tokenHash) ?? refreshTokens.find((t) => t.id === where.id);
      if (token) Object.assign(token, data);
      return token;
    },
    updateMany: async ({ where, data }: any) => {
      const targets = refreshTokens.filter((t) => {
        if (where.tokenHash && t.tokenHash !== where.tokenHash) return false;
        if (where.userId && t.userId !== where.userId) return false;
        if (where.revokedAt === null && t.revokedAt != null) return false;
        return true;
      });
      targets.forEach((t) => Object.assign(t, data));
      return { count: targets.length } as any;
    },
    deleteMany: async ({ where }: any) => {
      const before = refreshTokens.length;
      const now = Date.now();
      for (let i = refreshTokens.length - 1; i >= 0; i -= 1) {
        if (where.expiresAt?.lt && refreshTokens[i].expiresAt < where.expiresAt.lt) {
          refreshTokens.splice(i, 1);
        } else if (where.userId && refreshTokens[i].userId === where.userId && refreshTokens[i].expiresAt < now) {
          refreshTokens.splice(i, 1);
        }
      }
      return { count: before - refreshTokens.length } as any;
    },
  } as any,
} as PrismaService;

const configStub: Partial<ConfigService> = {
  get: (key: string) => {
    if (key === 'jwt.accessSecret') return 'test_access';
    if (key === 'jwt.refreshSecret') return 'test_refresh';
    if (key === 'jwt.accessExpiresIn') return '15m';
    if (key === 'jwt.refreshExpiresIn') return '7d';
    if (key === 'cookies.sameSite') return 'lax';
    if (key === 'cookies.secure') return false;
    return undefined;
  },
};

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        PrismaModule,
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .overrideProvider(ConfigService)
      .useValue(configStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers user and sets refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'Qwerty123', displayName: 'Test' })
      .expect(201);

    expect(res.body.tokens.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('refresh_token');
  });

  it('refreshes session via httpOnly cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'Qwerty123' })
      .expect(201);

    const cookies = login.headers['set-cookie'];
    const refresh = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookies).expect(201);
    expect(refresh.body.tokens.accessToken).toBeTruthy();
  });
});
