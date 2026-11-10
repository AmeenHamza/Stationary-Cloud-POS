import { describe, expect, it } from 'vitest';

import { MAX_EVENT_BYTES } from '@pos/contracts';

import { sliceUnderLimit } from './event-slices';

/** The widest `stock.changed` item: a uuid and the largest integers the columns hold. */
const item = (n: number) => ({
  productId: `0190f3a4-0000-7000-8000-${String(n).padStart(12, '0')}`,
  stockPieces: -2_147_483_648,
  isLowStock: false,
  version: 2_147_483_647,
});

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value));

describe('sliceUnderLimit', () => {
  it('keeps every slice of a 100-line bill within 1 KB, in order, losing nothing', () => {
    const items = Array.from({ length: 100 }, (_, n) => item(n));
    const slices = sliceUnderLimit('items', items);
    expect(slices.length).toBeGreaterThan(1);
    for (const slice of slices) {
      expect(bytes({ items: slice })).toBeLessThanOrEqual(MAX_EVENT_BYTES);
    }
    expect(slices.flat()).toEqual(items);
  });

  it('packs each slice as full as the limit allows', () => {
    const slices = sliceUnderLimit(
      'items',
      Array.from({ length: 30 }, (_, n) => item(n)),
    );
    for (const [index, slice] of slices.slice(0, -1).entries()) {
      const next = slices[index + 1]?.[0];
      expect(bytes({ items: [...slice, next] })).toBeGreaterThan(MAX_EVENT_BYTES);
    }
  });

  it('returns one slice when everything fits, none for no items', () => {
    const ids = ['a', 'b', 'c'];
    expect(sliceUnderLimit('crossedProductIds', ids)).toEqual([ids]);
    expect(sliceUnderLimit('items', [])).toEqual([]);
  });

  it('puts an item that is too big on its own into a slice of its own', () => {
    const huge = 'x'.repeat(MAX_EVENT_BYTES);
    expect(sliceUnderLimit('ids', ['a', huge, 'b'])).toEqual([['a'], [huge], ['b']]);
  });

  it('is exact at the boundary', () => {
    const empty = bytes({ ids: [] });
    const one = 'y'.repeat(10);
    const perItem = bytes(one);
    const fit = Math.floor((100 - empty + 1) / (perItem + 1));
    const slices = sliceUnderLimit(
      'ids',
      Array.from({ length: fit + 1 }, () => one),
      100,
    );
    expect(slices[0]).toHaveLength(fit);
    expect(bytes({ ids: slices[0] })).toBeLessThanOrEqual(100);
  });
});
