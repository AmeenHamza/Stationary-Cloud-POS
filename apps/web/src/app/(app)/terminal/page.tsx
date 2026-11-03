import { TerminalScreen } from '@/features/terminal';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Billing' };

export default function TerminalPage() {
  return <TerminalScreen />;
}
