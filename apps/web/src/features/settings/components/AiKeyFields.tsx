'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { UseFormRegisterReturn } from 'react-hook-form';

/** Whether a key is set and, if so, only its last 4 characters (F-30). */
export function AiKeyStatusLine({
  configured,
  last4,
}: {
  configured: boolean;
  last4: string | null | undefined;
}) {
  return (
    <p className="flex items-center gap-2 text-sm" aria-live="polite">
      {configured ? (
        <>
          <Badge variant="success">Configured</Badge>
          <span className="text-muted-foreground">Key ending •••• {last4}</span>
        </>
      ) : (
        <Badge variant="muted">Not configured</Badge>
      )}
    </p>
  );
}

/** A masked key input with a Show/Hide toggle; remount it (new `key`) to hide it again. */
export function SecretKeyInput({
  label,
  registration,
  error,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder="gsk_…"
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : `${id}-error`}
          {...registration}
        />
        <Button
          type="button"
          variant="outline"
          aria-label={visible ? 'Hide key' : 'Show key'}
          aria-pressed={visible}
          onClick={() => {
            setVisible((shown) => !shown);
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
          {visible ? 'Hide' : 'Show'}
        </Button>
      </div>
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
