'use client';

import { useApolloClient, useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { loginInputSchema, type LoginInput } from '@pos/validation';

import { FormTextField } from '@/components/forms/FormTextField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorCodeOf, userMessageOf } from '@/lib/errors/graphql-error';

import { LoginDocument, MeDocument } from '../graphql/auth.documents';
import { homePathFor } from '../routes';

import type { z } from 'zod';

const RATE_LIMITED = 'Too many attempts. Wait a few minutes, then try again.';

/** Username/password sign-in (F-01). */
export function LoginForm() {
  const router = useRouter();
  const client = useApolloClient();
  const [login, { loading }] = useMutation(LoginDocument);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof loginInputSchema>,
    unknown,
    LoginInput
  >({ resolver: zodResolver(loginInputSchema), defaultValues: { username: '', password: '' } });

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      const { data } = await login({ variables: { input } });
      const viewer = data?.login;
      if (viewer !== undefined) {
        client.writeQuery({ query: MeDocument, data: { me: viewer } });
        router.replace(homePathFor(viewer.role));
      }
    } catch (error) {
      setFormError(errorCodeOf(error) === 'RATE_LIMITED' ? RATE_LIMITED : userMessageOf(error));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="grid gap-5" noValidate>
      {formError !== null && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormTextField
        name="username"
        label="Username"
        register={register}
        error={formState.errors.username?.message}
        autoComplete="username"
        autoCapitalize="none"
        autoFocus
      />
      <FormTextField
        name="password"
        label="Password"
        type="password"
        register={register}
        error={formState.errors.password?.message}
        autoComplete="current-password"
      />
      <Button type="submit" variant="brand" size="lg" disabled={loading}>
        {loading && <Loader2Icon className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
