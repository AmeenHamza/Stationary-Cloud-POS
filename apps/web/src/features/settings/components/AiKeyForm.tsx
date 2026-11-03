'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { setAiApiKeyInputSchema, type SetAiApiKeyInput } from '@pos/validation';

import { Button } from '@/components/ui/button';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';
import { userMessageOf } from '@/lib/errors/graphql-error';

import {
  AiKeyStatusDocument,
  ClearAiApiKeyDocument,
  SetAiApiKeyDocument,
} from '../graphql/settings.documents';

import { AiKeyStatusLine, SecretKeyInput } from './AiKeyFields';

/**
 * The Groq API key for the AI Assistant (F-30). The key is typed here, sent once, stored encrypted
 * and never shown again: the screen knows only whether one is set and its last 4 characters.
 */
export function AiKeyForm() {
  const [saves, setSaves] = useState(0);
  const { data, error } = useQuery(AiKeyStatusDocument);
  const [save, { loading: saving }] = useMutation(SetAiApiKeyDocument);
  const [clear, { loading: clearing }] = useMutation(ClearAiApiKeyDocument);
  const { register, handleSubmit, formState, setError, reset } = useForm<
    SetAiApiKeyInput,
    unknown,
    SetAiApiKeyInput
  >({ resolver: zodResolver(setAiApiKeyInputSchema), defaultValues: { apiKey: '' } });
  const configured = data?.shopSettings.aiKeyConfigured === true;

  const submit = handleSubmit(async (input) => {
    try {
      await save({ variables: { input } });
      reset({ apiKey: '' });
      setSaves((count) => count + 1); // remounts the input, masked again
      toast.success('Groq API key saved.');
    } catch (cause) {
      applyFieldErrors(cause, setError, ['apiKey']);
    }
  });
  const remove = async () => {
    try {
      await clear();
      toast.success('Groq API key removed.');
    } catch (cause) {
      toast.error(userMessageOf(cause));
    }
  };

  return (
    <div className="grid max-w-2xl gap-4">
      {error !== undefined && <p className="text-destructive">{userMessageOf(error)}</p>}
      {data !== undefined && (
        <AiKeyStatusLine configured={configured} last4={data.shopSettings.aiKeyLast4} />
      )}
      <form onSubmit={(event) => void submit(event)} className="grid gap-2" noValidate>
        <SecretKeyInput
          key={saves}
          label={configured ? 'Replace key' : 'Groq API key'}
          registration={register('apiKey')}
          error={formState.errors.apiKey?.message}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save key
          </Button>
          {configured && (
            <Button
              type="button"
              variant="outline"
              disabled={clearing}
              onClick={() => void remove()}
            >
              Remove key
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
