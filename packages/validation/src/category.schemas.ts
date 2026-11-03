import { z } from 'zod';

import { idSchema, optionalText, requiredText, searchSchema, versionSchema } from './common.js';
import { pageArgsSchema } from './pagination.schemas.js';

const categoryFields = {
  name: requiredText(80, 'Category name'),
  iconEmoji: optionalText(16, 'Icon'),
  description: optionalText(200, 'Description'),
};

/** `createCategory` (F-12). */
export const createCategoryInputSchema = z.object(categoryFields);
export type CreateCategoryInput = z.output<typeof createCategoryInputSchema>;

/** `updateCategory` [V] (F-12). */
export const updateCategoryInputSchema = z.object({
  id: idSchema,
  ...categoryFields,
  version: versionSchema,
});
export type UpdateCategoryInput = z.output<typeof updateCategoryInputSchema>;

/** `categories(filter: { search }, first, after)`: name-ordered keyset pages. */
export const categoriesArgsSchema = pageArgsSchema.extend({
  filter: z.object({ search: searchSchema.nullish() }).nullish(),
});
export type CategoriesArgs = z.output<typeof categoriesArgsSchema>;
