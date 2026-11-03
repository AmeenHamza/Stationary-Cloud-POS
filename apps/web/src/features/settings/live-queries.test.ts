import { getOperationAST } from 'graphql';
import { describe, expect, it } from 'vitest';

import { LIVE_QUERIES } from '@/lib/realtime/live-queries';

import { AiKeyStatusDocument, ShopSettingsDocument } from './graphql/settings.documents';

describe('settings live query names (SYSTEM_DESIGN.md §5.4)', () => {
  it('are the real operations, so settings.changed refetches the open screens', () => {
    const names = [ShopSettingsDocument, AiKeyStatusDocument].map(
      (document) => getOperationAST(document)?.name?.value,
    );
    expect(names).toEqual(LIVE_QUERIES.settings);
  });
});
