import { getOperationAST } from 'graphql';
import { describe, expect, it } from 'vitest';

import { LIVE_QUERIES } from '@/lib/realtime/live-queries';

import { VendorLedgerDocument } from './graphql/vendors.documents';

describe('vendor live query name (SYSTEM_DESIGN.md §5.4)', () => {
  it('is the real ledger operation, so balance events refresh an open khata', () => {
    expect([getOperationAST(VendorLedgerDocument)?.name?.value]).toEqual(LIVE_QUERIES.vendorLedger);
  });
});
