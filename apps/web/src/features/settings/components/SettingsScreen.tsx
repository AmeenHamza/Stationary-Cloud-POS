'use client';

import { useQuery } from '@apollo/client/react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { ShopSettingsDocument } from '../graphql/settings.documents';

import { AiKeyForm } from './AiKeyForm';
import { ShopProfileForm } from './ShopProfileForm';

/**
 * Settings (Q26) and the Groq key for the AI Assistant (F-30). The form remounts when the settings version changes (a save here or a live
 * `settings.changed` from another admin), so it always edits the current values.
 */
export function SettingsScreen() {
  const { data, error } = useQuery(ShopSettingsDocument);
  const settings = data?.shopSettings;
  return (
    <>
      <PageHeader
        title="Settings"
        description="Shop details for receipts, billing defaults and the AI Assistant key."
      />
      <Card>
        <CardHeader>
          <CardTitle>Shop profile</CardTitle>
        </CardHeader>
        <CardContent>
          {error !== undefined && <p className="text-destructive">{userMessageOf(error)}</p>}
          {settings === undefined && error === undefined && (
            <p className="text-muted-foreground">Loading settings…</p>
          )}
          {settings !== undefined && <ShopProfileForm key={settings.version} settings={settings} />}
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>AI Assistant (Groq)</CardTitle>
        </CardHeader>
        <CardContent>
          <AiKeyForm />
        </CardContent>
      </Card>
    </>
  );
}
