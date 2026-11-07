import './globals.css';
import '@/styles/print-receipt.css';
import '@/styles/print-receipt-items.css';
import '@/styles/print-view.css';

import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme/theme';
import { AppProviders } from '@/providers/AppProviders';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Brandwings POS', template: '%s · Brandwings POS' },
  description: 'Point of sale for the shop counters.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#121629' },
  ],
};

/** Static shell (ADR-003): every screen renders on the client from the API. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
