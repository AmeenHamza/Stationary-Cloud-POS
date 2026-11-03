'use client';

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

import { safeLocalStorage } from '@/lib/storage/safe-local-storage';
import {
  THEME_STORAGE_KEY,
  isThemeChoice,
  resolveTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from '@/lib/theme/theme';

import type { ReactNode } from 'react';

interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  const stored = safeLocalStorage.get(THEME_STORAGE_KEY);
  return isThemeChoice(stored) ? stored : 'system';
}

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Updates <html> directly; the inline bootstrap script did the same before first paint. */
function apply(choice: ThemeChoice): void {
  const theme = resolveTheme(choice, prefersDark());
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onMedia = (): void => {
    apply(readChoice());
    onChange();
  };
  listeners.add(onChange);
  media.addEventListener('change', onMedia);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onMedia);
  };
}

function setChoice(choice: ThemeChoice): void {
  safeLocalStorage.set(THEME_STORAGE_KEY, choice);
  apply(choice);
  for (const listener of listeners) {
    listener();
  }
}

/** Light/Dark theme (F-05) from localStorage and the OS setting, without hydration mismatches. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as const);
  const dark = useSyncExternalStore(subscribe, prefersDark, () => false);
  const value = useMemo(
    () => ({ choice, resolved: resolveTheme(choice, dark), setChoice }),
    [choice, dark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return value;
}
