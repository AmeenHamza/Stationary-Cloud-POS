'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { FullPageSpinner } from '@/components/feedback/FullPageSpinner';

import { useViewer } from '../hooks/useViewer';
import { homePathFor } from '../routes';

import type { UserRole } from '@pos/contracts';
import type { ReactNode } from 'react';

/** `/`: sends the signed-in user to their role's home. */
export function RoleRedirect() {
  const router = useRouter();
  const { role } = useViewer();
  useEffect(() => {
    router.replace(homePathFor(role));
  }, [role, router]);
  return <FullPageSpinner />;
}

/** Admin-only areas: other roles are sent home (the API enforces permissions regardless). */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const router = useRouter();
  const viewer = useViewer();
  const allowed = viewer.role === role;
  useEffect(() => {
    if (!allowed) {
      router.replace(homePathFor(viewer.role));
    }
  }, [allowed, viewer.role, router]);
  return allowed ? children : <FullPageSpinner />;
}
