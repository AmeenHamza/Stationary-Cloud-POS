import { z } from 'zod';

/**
 * Public build-time settings (DEPLOYMENT.md §4.2). Next inlines `process.env.NEXT_PUBLIC_*` only when
 * written literally, so each variable is read by name here and nowhere else.
 */
const schema = z.object({
  apiUrl: z.url({
    error: 'NEXT_PUBLIC_API_URL must be the API origin, e.g. http://localhost:4000',
  }),
});

export const env = schema.parse({
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
});
