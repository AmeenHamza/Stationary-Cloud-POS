import { notFound } from 'next/navigation';

import { AI_FEATURE_LIST, AiChatScreen, AiFeatureScreen, aiFeatureBySlug } from '@/features/ai';

import type { Metadata } from 'next';

interface Props {
  params: Promise<{ feature: string }>;
}

/** The six feature pages are known at build time; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { feature: string }[] {
  return AI_FEATURE_LIST.map((info) => ({ feature: info.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const info = aiFeatureBySlug((await params).feature);
  return { title: info?.title ?? 'AI Assistant' };
}

/** One AI Assistant feature (F-29); "Ask your POS" is the chat. */
export default async function AiFeaturePage({ params }: Props) {
  const info = aiFeatureBySlug((await params).feature);
  if (info === undefined) {
    notFound();
  }
  return info.feature === 'ASK' ? (
    <AiChatScreen />
  ) : (
    <AiFeatureScreen info={{ ...info, feature: info.feature }} />
  );
}
