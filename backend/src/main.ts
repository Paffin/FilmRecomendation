import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  const config = app.get(ConfigService);

  // Мы за reverse-proxy (nginx в Docker), поэтому доверяем заголовкам X-Forwarded-For.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200, // базовый лимит, можно вынести в конфиг
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30, // более строгий лимит на auth
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const allowedOrigins = config.get<string[]>('cors.allowedOrigins') ?? ['http://localhost:5173'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
