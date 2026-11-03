'use client';

import { useQuery } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { FullPageSpinner } from '@/components/feedback/FullPageSpinner';
import { Button } from '@/components/ui/button';
import { errorCodeOf, userMessageOf } from '@/lib/errors/graphql-error';

import { MeDocument } from '../graphql/auth.documents';
import { ViewerContext } from '../hooks/useViewer';
import { LOGIN_PATH } from '../routes';

import type { ReactNode } from 'react';

/**
 * Renders its children only for a signed-in user (one `me` query per page load, then cache).
 * No session → /login. A network failure shows a retry instead of logging the user out.
 */
export function ViewerGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, error, refetch } = useQuery(MeDocument);
  const unauthenticated = errorCodeOf(error) === 'UNAUTHENTICATED';

  useEffect(() => {
    if (unauthenticated) {
      router.replace(LOGIN_PATH);
    }
  }, [unauthenticated, router]);

  if (data?.me !== undefined) {
    return <ViewerContext.Provider value={data.me}>{children}</ViewerContext.Provider>;
  }
  if (error !== undefined && !unauthenticated) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">{userMessageOf(error)}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return <FullPageSpinner />;
}
