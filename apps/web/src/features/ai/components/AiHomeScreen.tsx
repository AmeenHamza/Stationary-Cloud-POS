import {
  BarChart3Icon,
  BotMessageSquareIcon,
  FileTextIcon,
  PackageSearchIcon,
  PercentIcon,
  ShoppingBasketIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { AI_FEATURE_LIST } from '../lib/ai-features';

import { AiKeyNotice } from './AiKeyNotice';

import type { AiFeature } from '@pos/contracts';

const ICONS: Readonly<Record<AiFeature, LucideIcon>> = {
  SALES_INSIGHTS: BarChart3Icon,
  INVENTORY_FORECAST: PackageSearchIcon,
  PURCHASE_RECOMMENDATIONS: ShoppingBasketIcon,
  ASK: BotMessageSquareIcon,
  BUSINESS_REPORT: FileTextIcon,
  DISCOUNT_ADVICE: PercentIcon,
};

/** AI Assistant home (F-29, D-22): the six features, admins only, answers in three languages. */
export function AiHomeScreen() {
  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Answers from your live sales and stock figures, in English, Urdu or Roman Urdu."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">Admin only</Badge>
        <Badge variant="outline">Live data</Badge>
        <Badge variant="outline">3 languages</Badge>
      </div>
      <AiKeyNotice />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {AI_FEATURE_LIST.map((info) => {
          const Icon = ICONS[info.feature];
          return (
            <li key={info.slug}>
              <Link
                href={`/ai/${info.slug}`}
                className="block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <CardTitle>{info.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {info.description}
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
