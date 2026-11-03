import { z } from 'zod';

import { optionalText, percentSchema, phoneSchema, requiredText, versionSchema } from './common.js';

const logoDataUrlSchema = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .max(350_000, { error: 'Logo image is too large' })
      .regex(/^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/, {
        error: 'Logo must be a PNG, JPEG, or WEBP image',
      }),
  ])
  .nullish()
  .transform((value) => (value === undefined || value === null || value === '' ? null : value));

/** `updateShopSettings` — shop profile used on receipts and the default Bill GST rate (Q26). */
export const updateShopSettingsInputSchema = z.object({
  shopName: requiredText(120, 'Shop name'),
  address: optionalText(300, 'Address'),
  phone: phoneSchema,
  receiptFooter: optionalText(300, 'Receipt footer'),
  exchangeReturnPolicy: optionalText(1000, 'Exchange & return policy'),
  logoDataUrl: logoDataUrlSchema,
  defaultBillGstRate: percentSchema,
  version: versionSchema,
});
export type UpdateShopSettingsInput = z.output<typeof updateShopSettingsInputSchema>;

/** `setAiApiKey` (F-30). The key is encrypted at rest and never returned (SYSTEM_DESIGN.md §9.1). */
export const setAiApiKeyInputSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, { error: 'The API key looks too short' })
    .max(200, { error: 'The API key looks too long' })
    .regex(/^\S+$/, { error: 'The API key cannot contain spaces' }),
});
export type SetAiApiKeyInput = z.output<typeof setAiApiKeyInputSchema>;
