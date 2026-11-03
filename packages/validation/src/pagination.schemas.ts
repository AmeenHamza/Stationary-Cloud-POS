import { z } from 'zod';

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@pos/contracts';

/**
 * Arguments of every connection field (API.md §3): `first` defaults to 50 and may never exceed 50;
 * `after` is an opaque cursor validated further by the API's cursor codec.
 */
export const pageArgsSchema = z.object({
  first: z
    .int({ error: 'first must be a whole number' })
    .min(1, { error: 'first must be at least 1' })
    .max(PAGE_SIZE_MAX, { error: `first must be at most ${String(PAGE_SIZE_MAX)}` })
    .default(PAGE_SIZE_DEFAULT),
  after: z.string().min(1).max(512).nullish(),
});

export type PageArgs = z.output<typeof pageArgsSchema>;
