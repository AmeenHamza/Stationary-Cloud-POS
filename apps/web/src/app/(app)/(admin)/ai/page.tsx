import { AiHomeScreen } from '@/features/ai';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Assistant' };

/** AI Assistant home (F-29, D-22): admins only. */
export default function AiPage() {
  return <AiHomeScreen />;
}
