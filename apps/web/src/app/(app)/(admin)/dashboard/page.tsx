import { DashboardScreen } from '@/features/dashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Overview' };

/** Admin overview: today's tiles, summaries and sales charts (F-06, F-07). */
export default function DashboardPage() {
  return <DashboardScreen />;
}
