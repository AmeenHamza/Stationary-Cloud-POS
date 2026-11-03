import { z } from 'zod';

import { USER_ROLES, USER_STATUSES } from '@pos/contracts';

import {
  idSchema,
  passwordSchema,
  requiredText,
  searchSchema,
  usernameSchema,
  versionSchema,
} from './common.js';
import { pageArgsSchema } from './pagination.schemas.js';

const fullName = requiredText(120, 'Full name');
const role = z.enum(USER_ROLES, { error: 'Choose a role' });

/** `createStaffUser` (F-31, D-10). The password may not equal the username (API.md §10.1). */
export const createStaffUserInputSchema = z
  .object({ username: usernameSchema, fullName, role, password: passwordSchema })
  .refine((input) => input.password.toLowerCase() !== input.username, {
    error: 'The password must not be the username',
    path: ['password'],
  });
export type CreateStaffUserInput = z.output<typeof createStaffUserInputSchema>;

export const signUpInputSchema = createStaffUserInputSchema.safeExtend({
  signupSecret: z.string().min(1).max(1024),
});
export type SignUpInput = z.output<typeof signUpInputSchema>;

/** `updateStaffUser`: name and role only; a role change revokes the user's sessions. */
export const updateStaffUserInputSchema = z.object({
  id: idSchema,
  fullName,
  role,
  version: versionSchema,
});
export type UpdateStaffUserInput = z.output<typeof updateStaffUserInputSchema>;

export const setStaffUserStatusInputSchema = z.object({
  id: idSchema,
  status: z.enum(USER_STATUSES),
});
export type SetStaffUserStatusInput = z.output<typeof setStaffUserStatusInputSchema>;

export const resetStaffPasswordInputSchema = z.object({
  id: idSchema,
  newPassword: passwordSchema,
});
export type ResetStaffPasswordInput = z.output<typeof resetStaffPasswordInputSchema>;

/** `staffUsers(filter: { search, status }, first, after)`: name-ordered pages of 50 at most. */
export const staffUsersArgsSchema = pageArgsSchema.extend({
  filter: z
    .object({ search: searchSchema.nullish(), status: z.enum(USER_STATUSES).nullish() })
    .nullish(),
});
export type StaffUsersArgs = z.output<typeof staffUsersArgsSchema>;
