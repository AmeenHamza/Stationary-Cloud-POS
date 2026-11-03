import type { UserRole } from '@pos/contracts';

/**
 * Where each role lands after login: admins on the overview (F-06), cashiers on the billing
 * terminal.
 */
export function homePathFor(role: UserRole): string {
  return role === 'ADMIN' ? '/dashboard' : '/terminal';
}

export const LOGIN_PATH = '/login';
