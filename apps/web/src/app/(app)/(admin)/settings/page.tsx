import { SettingsScreen } from '@/features/settings';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

/** Shop profile and billing defaults (Q26). */
export default function SettingsPage() {
  return <SettingsScreen />;
}
