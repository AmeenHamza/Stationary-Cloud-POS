'use client';

import { Button } from '@/components/ui/button';

/** Unexpected rendering errors inside a page: offer a retry, never a stack trace. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">The page could not be shown. Try again.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
