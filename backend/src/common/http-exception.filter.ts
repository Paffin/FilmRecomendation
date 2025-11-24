import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp ? exception.getResponse() : 'Internal server error';

    const payload = {
      statusCode: status,
      message:
        typeof message === 'string'
          ? message
          : ((message as any)?.message ?? 'Internal server error'),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] ?? undefined,
    };

    const errorLog = isHttp ? (exception as HttpException).message : String(exception);
    this.logger.error(`${request.method} ${request.url} -> ${status}: ${errorLog}`);
    response.status(status).json(payload);
  }
}
