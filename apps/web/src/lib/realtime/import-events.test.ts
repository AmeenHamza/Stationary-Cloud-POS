import { InMemoryCache } from '@apollo/client';
import { describe, expect, it, vi } from 'vitest';

import { ImportJobProgressFragment } from '@/graphql/fragments/import.fragments';

import { routeEvent, type EventContext } from './event-router';

import type { EventOf } from './event-types';

const JOB = {
  __typename: 'ImportJob' as const,
  id: 'j1',
  status: 'RUNNING' as const,
  processedRows: 100,
  totalRows: 300,
  succeededRows: 99,
  failedRows: 1,
};

const progressed = (processedRows: number): EventOf<'ImportProgressedEvent'> => ({
  __typename: 'ImportProgressedEvent',
  seq: String(processedRows),
  type: 'import.progressed',
  importJobId: 'j1',
  importStatus: processedRows === 300 ? 'COMPLETED' : 'RUNNING',
  processedRows,
  totalRows: 300,
  succeededRows: processedRows - 1,
  failedRows: 1,
});

const context = (cache: InMemoryCache): EventContext => ({
  cache,
  refetchSoon: vi.fn(),
  resync: vi.fn(),
});

describe('import events (API.md §7.2, F-11)', () => {
  it('import.progressed moves a cached job forward only, and never creates one', () => {
    const cache = new InMemoryCache();
    cache.writeFragment({ id: 'ImportJob:j1', fragment: ImportJobProgressFragment, data: JOB });
    const ctx = context(cache);
    const read = () =>
      cache.readFragment({ id: 'ImportJob:j1', fragment: ImportJobProgressFragment });
    routeEvent(progressed(300), ctx);
    expect(read()).toMatchObject({ status: 'COMPLETED', processedRows: 300, succeededRows: 299 });
    routeEvent(progressed(200), ctx); // late, older event
    expect(read()?.processedRows).toBe(300);
    routeEvent({ ...progressed(50), importJobId: 'unseen' }, ctx);
    expect(cache.extract()['ImportJob:unseen']).toBeUndefined();
    expect(ctx.refetchSoon).not.toHaveBeenCalled();
  });

  it('catalog.bulkChanged runs one recovery instead of patching thousands of rows', () => {
    const ctx = context(new InMemoryCache());
    routeEvent(
      {
        __typename: 'CatalogBulkChangedEvent',
        seq: '1',
        type: 'catalog.bulkChanged',
        importJobId: 'j1',
        changedCount: 2500,
      },
      ctx,
    );
    expect(ctx.resync).toHaveBeenCalledTimes(1);
  });
});
