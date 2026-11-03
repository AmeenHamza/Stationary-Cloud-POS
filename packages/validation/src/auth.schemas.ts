import { z } from 'zod';

import { passwordSchema } from './common.js';

/** `login` (F-01). Only presence and length are checked: the generic error hides which part failed. */
export const loginInputSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, { error: 'Username is required' }).max(40),
  password: z.string().min(1, { error: 'Password is required' }).max(128),
});
export type LoginInput = z.output<typeof loginInputSchema>;

const changePasswordFields = {
  currentPassword: z.string().min(1, { error: 'Current password is required' }).max(128),
  newPassword: passwordSchema,
};

const differentFromCurrent = {
  check: (input: { currentPassword: string; newPassword: string }) =>
    input.newPassword !== input.currentPassword,
  params: { error: 'The new password must be different', path: ['newPassword'] },
};

/** `changePassword` (F-03), as the API receives it. */
export const changePasswordInputSchema = z
  .object(changePasswordFields)
  .refine(differentFromCurrent.check, differentFromCurrent.params);
export type ChangePasswordInput = z.output<typeof changePasswordInputSchema>;

/** The change-password form (F-03: current, new, confirm). `confirmNewPassword` never leaves the browser. */
export const changePasswordFormSchema = z
  .object({ ...changePasswordFields, confirmNewPassword: z.string() })
  .refine(differentFromCurrent.check, differentFromCurrent.params)
  .refine((input) => input.confirmNewPassword === input.newPassword, {
    error: 'The passwords do not match',
    path: ['confirmNewPassword'],
  });
export type ChangePasswordForm = z.output<typeof changePasswordFormSchema>;
