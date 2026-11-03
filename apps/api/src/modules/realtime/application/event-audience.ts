import { channelFor, userAudience } from '../../../infrastructure/realtime/channels';

import type { Principal } from '../../../common/auth/principal';

/**
 * Redis channels a viewer's socket listens to (SYSTEM_DESIGN.md §5.3): everyone hears `staff` and their
 * own `user:{id}`; admins also hear `admin`. Unauthorized events therefore never reach a socket.
 */
export function channelsFor(principal: Principal): string[] {
  const channels = [channelFor('staff'), channelFor(userAudience(principal.userId))];
  return principal.role === 'ADMIN' ? [...channels, channelFor('admin')] : channels;
}

/** WebSocket close codes (API.md §7.5). */
export const WS_CLOSE = {
  unauthenticated: 4401,
  forbidden: 4403,
  tooMany: 4429,
} as const;
