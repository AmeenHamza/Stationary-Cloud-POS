import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { AppError } from '../errors/app-error';

import type { Request } from 'express';

/**
 * Mutating REST requests must carry `X-POS-CSRF: 1` (API.md §9). A custom header forces a CORS
 * preflight, which only the web app's origin passes, so another site cannot post with the cookie.
 */
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers['x-pos-csrf'] !== '1') {
      throw new AppError('FORBIDDEN', 'This request is missing its CSRF header.');
    }
    return true;
  }
}
