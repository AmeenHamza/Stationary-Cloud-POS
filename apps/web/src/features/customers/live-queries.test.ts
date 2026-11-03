import { getOperationAST } from 'graphql';
import { describe, expect, it } from 'vitest';

import { LIVE_QUERIES } from '@/lib/realtime/live-queries';

import { CustomerLedgerDocument } from './graphql/customers.documents';

describe('customer live query name (SYSTEM_DESIGN.md §5.4)', () => {
  it('is the real ledger operation, so balance events refresh an open khata', () => {
    expect([getOperationAST(CustomerLedgerDocument)?.name?.value]).toEqual(
      LIVE_QUERIES.customerLedger,
    );
  });
});
