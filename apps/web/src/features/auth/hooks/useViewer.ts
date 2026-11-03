'use client';

import { createContext, useContext } from 'react';

import { hasPermission, type Permission, type UserRole } from '@pos/contracts';

export interface Viewer {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export const ViewerContext = createContext<Viewer | null>(null);

/** The signed-in user. Only valid below <ViewerGate>. */
export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (viewer === null) {
    throw new Error('useViewer must be used inside <ViewerGate>');
  }
  return viewer;
}

/** Hides actions the role cannot perform. A UI convenience only: the API always decides (§2.4). */
export function useCan(permission: Permission): boolean {
  return hasPermission(useViewer().role, permission);
}
