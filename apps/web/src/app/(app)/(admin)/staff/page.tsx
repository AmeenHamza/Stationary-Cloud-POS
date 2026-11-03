import { StaffScreen } from '@/features/staff';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Staff' };

/** Staff management (F-31). */
export default function StaffPage() {
  return <StaffScreen />;
}
