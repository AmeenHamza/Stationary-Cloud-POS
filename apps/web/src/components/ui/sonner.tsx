'use client';

import { Toaster as Sonner } from 'sonner';

import { useTheme } from '@/providers/ThemeProvider';

/** Toast host (bottom-right), following the app theme. */
export function Toaster() {
  const { resolved } = useTheme();
  return <Sonner theme={resolved} position="bottom-right" richColors closeButton />;
}
