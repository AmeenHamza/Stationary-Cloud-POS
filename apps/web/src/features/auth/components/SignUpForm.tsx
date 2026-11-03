'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { signUpInputSchema, type SignUpInput } from '@pos/validation';

import { FormSelectField } from '@/components/forms/FormSelectField';
import { FormTextField } from '@/components/forms/FormTextField';
import { Button } from '@/components/ui/button';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { SignUpDocument } from '../graphql/auth.documents';
import { LOGIN_PATH } from '../routes';

import type { z } from 'zod';

const ROLES = [
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'ADMIN', label: 'Admin' },
] as const;

export function SignUpForm() {
  const router = useRouter();
  const [signUp, { loading }] = useMutation(SignUpDocument);
  const { register, handleSubmit, formState, setError } = useForm<
    z.input<typeof signUpInputSchema>,
    unknown,
    SignUpInput
  >({
    resolver: zodResolver(signUpInputSchema),
    defaultValues: { fullName: '', username: '', password: '', role: 'CASHIER', signupSecret: '' },
  });
  const submit = handleSubmit(async (input) => {
    try {
      const { data } = await signUp({ variables: { input } });
      if (data?.signUp === true) {
        toast.success('Account created. Sign in to continue.');
        router.replace(LOGIN_PATH);
      }
    } catch (error) {
      applyFieldErrors(error, setError, [
        'fullName',
        'username',
        'password',
        'role',
        'signupSecret',
      ]);
    }
  });
  const errors = formState.errors;
  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-5" noValidate>
      <FormTextField
        name="fullName"
        label="Full name"
        register={register}
        error={errors.fullName?.message}
        autoComplete="name"
      />
      <FormTextField
        name="username"
        label="Username"
        register={register}
        error={errors.username?.message}
        autoComplete="username"
        autoCapitalize="none"
      />
      <FormTextField
        name="password"
        label="Password"
        type="password"
        register={register}
        error={errors.password?.message}
        autoComplete="new-password"
      />
      <FormSelectField
        name="role"
        label="Role"
        register={register}
        options={ROLES}
        error={errors.role?.message}
      />
      <FormTextField
        name="signupSecret"
        label="Sign-up key"
        type="password"
        register={register}
        error={errors.signupSecret?.message}
        autoComplete="off"
      />
      <Button type="submit" variant="brand" size="lg" disabled={loading}>
        {loading && <Loader2Icon className="animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
