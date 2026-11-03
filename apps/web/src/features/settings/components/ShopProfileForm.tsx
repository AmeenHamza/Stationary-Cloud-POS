'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { updateShopSettingsInputSchema, type UpdateShopSettingsInput } from '@pos/validation';

import { FormTextField } from '@/components/forms/FormTextField';
import { Button } from '@/components/ui/button';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { UpdateShopSettingsDocument } from '../graphql/settings.documents';

import type { ShopSettingsQuery } from '@/graphql/__generated__/graphql';
import type { z } from 'zod';

type ProfileForm = z.input<typeof updateShopSettingsInputSchema>;
type ShopSettings = ShopSettingsQuery['shopSettings'];

const MAX_LOGO_BYTES = 220 * 1024;
const FIELDS = [
  'shopName',
  'address',
  'phone',
  'receiptFooter',
  'exchangeReturnPolicy',
  'logoDataUrl',
  'defaultBillGstRate',
] as const;

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Could not read image file.'));
    };
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Shop profile printed on receipts and the default Bill GST for new bills (Q26). Saved against the
 * version loaded with the form, so a concurrent change by another admin is reported, not lost.
 */
export function ShopProfileForm({ settings }: { settings: ShopSettings }) {
  const [save, { loading }] = useMutation(UpdateShopSettingsDocument);
  const logoInputId = useId();
  const { register, handleSubmit, formState, setError, setValue, watch } = useForm<
    ProfileForm,
    unknown,
    UpdateShopSettingsInput
  >({
    resolver: zodResolver(updateShopSettingsInputSchema),
    defaultValues: {
      shopName: settings.shopName,
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      receiptFooter: settings.receiptFooter ?? '',
      exchangeReturnPolicy: settings.exchangeReturnPolicy ?? '',
      logoDataUrl: settings.logoDataUrl ?? '',
      defaultBillGstRate: settings.defaultBillGstRate,
      version: settings.version,
    },
  });
  const logoDataUrl = watch('logoDataUrl') ?? '';
  const errors = formState.errors;
  const submit = handleSubmit(async (input) => {
    try {
      await save({ variables: { input } });
      toast.success('Shop settings saved.');
    } catch (error) {
      applyFieldErrors(error, setError, FIELDS);
    }
  });
  return (
    <form onSubmit={(event) => void submit(event)} className="grid max-w-2xl gap-4" noValidate>
      <FormTextField
        name="shopName"
        label="Shop name"
        register={register}
        error={errors.shopName?.message}
      />
      <FormTextField
        name="address"
        label="Address"
        register={register}
        error={errors.address?.message}
      />
      <FormTextField
        name="phone"
        label="Phone"
        inputMode="tel"
        register={register}
        error={errors.phone?.message}
      />
      <FormTextField
        name="receiptFooter"
        label="Receipt footer"
        placeholder="Thank you for shopping with us"
        register={register}
        error={errors.receiptFooter?.message}
      />
      <input type="hidden" {...register('logoDataUrl')} />
      <div className="grid gap-2">
        <label htmlFor={logoInputId} className="text-sm font-medium">
          Receipt logo (optional)
        </label>
        <input
          id={logoInputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file === undefined) {
              return;
            }
            if (file.size > MAX_LOGO_BYTES) {
              setError('logoDataUrl', { message: 'Logo image must be 220 KB or smaller' });
              return;
            }
            void toDataUrl(file)
              .then((dataUrl) => {
                setValue('logoDataUrl', dataUrl, { shouldDirty: true, shouldValidate: true });
              })
              .catch(() => {
                setError('logoDataUrl', { message: 'Could not read logo image' });
              });
          }}
        />
        {logoDataUrl !== '' && (
          <div className="flex items-center gap-3">
            <img src={logoDataUrl} alt="Receipt logo preview" className="h-12 w-12 rounded border object-contain" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue('logoDataUrl', '', { shouldDirty: true, shouldValidate: true });
              }}
            >
              Remove logo
            </Button>
          </div>
        )}
        {errors.logoDataUrl?.message !== undefined && (
          <p className="text-sm text-destructive">{errors.logoDataUrl.message}</p>
        )}
      </div>
      <FormTextField
        name="exchangeReturnPolicy"
        label="Exchange & return policy"
        placeholder="Items can be exchanged or returned within 2 days of purchase."
        register={register}
        error={errors.exchangeReturnPolicy?.message}
      />
      <FormTextField
        name="defaultBillGstRate"
        label="Default Bill GST %"
        inputMode="decimal"
        register={register}
        error={errors.defaultBillGstRate?.message}
      />
      <div>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2Icon className="animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}
