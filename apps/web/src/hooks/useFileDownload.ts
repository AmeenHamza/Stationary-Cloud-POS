'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { env } from '@/lib/env';

/**
 * Downloads a file from the API with the session cookie (exports, the import template and error
 * report, API.md §9). A refusal (403, 429) is shown as a toast instead of navigating away.
 */
export function useFileDownload() {
  const [busy, setBusy] = useState(false);
  const download = async (path: string, fileName: string): Promise<void> => {
    setBusy(true);
    try {
      const response = await fetch(`${env.apiUrl}${path}`, { credentials: 'include' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(body?.message ?? 'The download failed. Try again.');
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Cannot reach the server. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return { download, busy };
}
