import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

import { assignedRequestId } from '../logging/request-id';

import { httpStatusFor } from './app-error';
import { toPublicError } from './public-error';

import type { Request, Response } from 'express';

/**
 * REST error responses `{ code, message, requestId }` (SYSTEM_DESIGN.md §10). GraphQL errors are
 * left to Apollo's formatter, so this filter re-throws them.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType<string>() !== 'http') {
      throw exception;
    }
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = assignedRequestId(request);
    const known = toPublicError(exception);
    if (known !== null) {
      response.status(httpStatusFor(known.code)).json({
        code: known.code,
        message: known.message,
        ...known.details,
        requestId,
      });
      return;
    }
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      response
        .status(exception.getStatus())
        .json({ code: 'BAD_USER_INPUT', message: exception.message, requestId });
      return;
    }
    this.logger.error({ err: exception, requestId }, 'Unhandled REST error');
    response
      .status(500)
      .json({ code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong.', requestId });
  }
}
