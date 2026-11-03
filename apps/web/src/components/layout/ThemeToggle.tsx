'use client';

import { MoonIcon, SunIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

/** One-click light/dark switch (F-05), for screens without the account menu (login). */
export function ThemeToggle() {
  const { resolved, setChoice } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={() => {
        setChoice(next);
      }}
      aria-label={`Switch to ${next} theme`}
    >
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
      {resolved === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}
