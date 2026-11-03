import type { SessionRequest } from '../../common/auth/principal';
import type { CookieOptions, Response } from 'express';

/**
 * Session cookie (ADR-011): `__Host-` prefix (Secure, Path=/, no Domain), HttpOnly, SameSite=Strict.
 * The web app and API are same-site (pos.<domain> → api.<domain>; localhost in development).
 */
export const SESSION_COOKIE = '__Host-pos_sid';

const BASE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };

/** 32 random bytes as base64url: exactly 43 characters. */
const TOKEN_FORMAT = /^[\w-]{43}$/;

/**
 * The session token of an HTTP request (parsed by cookie-parser) or a WebSocket upgrade request,
 * where no Express middleware runs, so the raw `Cookie` header is read instead.
 */
export function readSessionToken(request: SessionRequest): string | null {
  const token = request.cookies?.[SESSION_COOKIE] ?? fromCookieHeader(request.headers.cookie);
  return token !== undefined && TOKEN_FORMAT.test(token) ? token : null;
}

function fromCookieHeader(header: string | undefined): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      return value.join('=');
    }
  }
  return undefined;
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  now: Date,
): void {
  response.cookie(SESSION_COOKIE, token, {
    ...BASE,
    maxAge: Math.max(0, expiresAt.getTime() - now.getTime()),
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, BASE);
}
