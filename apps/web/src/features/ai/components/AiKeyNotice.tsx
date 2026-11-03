'use client';

import { useQuery } from '@apollo/client/react';
import { ArrowLeftIcon, KeyRoundIcon } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AiKeyStatusDocument } from '@/features/settings';

/** Shown when no Groq key is set (F-30): the features answer `AI_NOT_CONFIGURED` until it is. */
export function AiKeyNotice() {
  const { data } = useQuery(AiKeyStatusDocument);
  if (data?.shopSettings.aiKeyConfigured !== false) {
    return null;
  }
  return (
    <Alert variant="warning" className="mb-6">
      <KeyRoundIcon />
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span className="flex-1">
          Add the shop&apos;s Groq API key in Settings to use the AI Assistant.
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings">Open Settings</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function AiBackLink() {
  return (
    <Button asChild variant="outline">
      <Link href="/ai">
        <ArrowLeftIcon />
        All AI features
      </Link>
    </Button>
  );
}
