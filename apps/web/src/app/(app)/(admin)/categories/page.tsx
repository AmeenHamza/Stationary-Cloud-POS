import { CategoriesScreen } from '@/features/catalog';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Categories' };

/** Categories grid (F-12). */
export default function CategoriesPage() {
  return <CategoriesScreen />;
}
