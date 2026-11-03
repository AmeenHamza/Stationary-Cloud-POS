import { ViewerGate } from '@/features/auth';
import { RealtimeProvider } from '@/providers/RealtimeProvider';

import type { ReactNode } from 'react';

/** Every signed-in area: no session → /login; one live `shopEvents` channel per tab. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ViewerGate>
      <RealtimeProvider>{children}</RealtimeProvider>
    </ViewerGate>
  );
}
