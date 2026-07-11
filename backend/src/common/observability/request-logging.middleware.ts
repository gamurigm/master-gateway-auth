import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { RequestWithUser } from '../auth/request-with-user';

type RequestWithContext = RequestWithUser & {
  requestId?: string;
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: RequestWithContext, response: Response, next: NextFunction) {
    const requestId = normalizeRequestId(request.headers['x-request-id']);
    const startedAt = Date.now();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const payload = {
        event: 'http.request',
        requestId,
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        userId: request.user?.sub,
        roleName: request.user?.roleName,
      };
      const message = JSON.stringify(payload);

      if (response.statusCode >= 500) {
        this.logger.error(message);
      } else if (response.statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}

function normalizeRequestId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && /^[a-zA-Z0-9_.:-]{1,128}$/.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}
