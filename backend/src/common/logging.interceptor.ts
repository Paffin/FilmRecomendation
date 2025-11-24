import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  HttpException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${method} ${url} ${Date.now() - started}ms`),
        error: (err) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          const msg = `${method} ${url} -> ${status} in ${Date.now() - started}ms: ${err?.message ?? err}`;
          if (status >= 500) {
            this.logger.error(msg);
          } else {
            this.logger.warn(msg);
          }
        },
      }),
    );
  }
}
