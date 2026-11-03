import { CloudOffIcon, RefreshCwIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

const MESSAGES = {
  reconnecting: 'Live updates paused, reconnecting…',
  offline: 'Offline: billing paused. Check the network connection.',
} as const;

/**
 * Connection banner (F-37, SYSTEM_DESIGN.md §5.8): amber while live updates reconnect (billing still
 * works over HTTP), red while the API cannot be reached. Nothing when connected or still connecting.
 */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status !== 'reconnecting' && status !== 'offline') {
    return null;
  }
  const Icon = status === 'offline' ? CloudOffIcon : RefreshCwIcon;
  return (
    <div
      role="status"
      aria-live="polite"
      data-status={status}
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium',
        status === 'offline'
          ? 'bg-destructive text-white'
          : 'bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50',
      )}
    >
      <Icon className={cn('size-4', status === 'reconnecting' && 'animate-spin')} aria-hidden />
      {MESSAGES[status]}
    </div>
  );
}
