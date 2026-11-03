'use client';

import { ApolloProvider, useApolloClient } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { createApolloClient } from '@/lib/apollo/create-apollo-client';
import { notifySessionEnded, onSessionEnded } from '@/lib/apollo/session-events';

import { ThemeProvider } from './ThemeProvider';

import type { ReactNode } from 'react';

/** When the session ends anywhere, forget the cached data and open the login screen. */
function SessionEndedRedirect() {
  const client = useApolloClient();
  const router = useRouter();
  useEffect(
    () =>
      onSessionEnded(() => {
        void client.clearStore();
        router.replace('/login');
      }),
    [client, router],
  );
  return null;
}

/** Client-side providers for every page: theme, Apollo (one client per tab) and toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => createApolloClient(notifySessionEnded));
  return (
    <ThemeProvider>
      <ApolloProvider client={client}>
        <SessionEndedRedirect />
        {children}
        <Toaster />
      </ApolloProvider>
    </ThemeProvider>
  );
}
