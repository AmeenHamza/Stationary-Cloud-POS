import type { AiFeature } from '@pos/contracts';

/** What a feature asks for besides the language. */
export type AiFeatureInputs = 'none' | 'days' | 'report' | 'chat';

export interface AiFeatureInfo {
  feature: AiFeature;
  slug: string;
  title: string;
  description: string;
  inputs: AiFeatureInputs;
  /** Shows the Print action (Business Reports, F-29). */
  printable: boolean;
}

/** The six AI Assistant features (F-29, FEATURES.md §3.11), in the order of the old app. */
export const AI_FEATURE_LIST: readonly AiFeatureInfo[] = [
  {
    feature: 'SALES_INSIGHTS',
    slug: 'sales-insights',
    title: 'Sales insights',
    description: 'How sales went over 7 to 90 days, with best and slowest sellers.',
    inputs: 'days',
    printable: false,
  },
  {
    feature: 'INVENTORY_FORECAST',
    slug: 'inventory-forecast',
    title: 'Inventory forecast',
    description: 'Which products run out first, from 30 days of sales.',
    inputs: 'none',
    printable: false,
  },
  {
    feature: 'PURCHASE_RECOMMENDATIONS',
    slug: 'purchase-recommendations',
    title: 'Purchase recommendations',
    description: 'What to buy and its estimated cost, from 45 days of sales.',
    inputs: 'none',
    printable: false,
  },
  {
    feature: 'ASK',
    slug: 'ask',
    title: 'Ask your POS',
    description: 'Ask about sales, products and stock in your own words.',
    inputs: 'chat',
    printable: false,
  },
  {
    feature: 'BUSINESS_REPORT',
    slug: 'business-report',
    title: 'Business reports',
    description: 'A printable daily, weekly, monthly or custom report.',
    inputs: 'report',
    printable: true,
  },
  {
    feature: 'DISCOUNT_ADVICE',
    slug: 'discount-advice',
    title: 'Discount advisor',
    description: 'Discount ideas for slow stock. Recommendations only: nothing changes by itself.',
    inputs: 'none',
    printable: false,
  },
];

export function aiFeatureBySlug(slug: string): AiFeatureInfo | undefined {
  return AI_FEATURE_LIST.find((info) => info.slug === slug);
}
