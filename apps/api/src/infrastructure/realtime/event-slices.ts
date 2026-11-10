import { MAX_EVENT_BYTES } from '@pos/contracts';

const bytesOf = (value: unknown): number => Buffer.byteLength(JSON.stringify(value));

/**
 * Splits `items` into consecutive slices so that `{ [field]: slice }` stays within `maxBytes`
 * (NETWORK_OPTIMIZATION.md §4.3). Order is kept. An item that is too big on its own gets a slice of
 * its own, and `OutboxService.add` then refuses it as before.
 */
export function sliceUnderLimit<T>(
  field: string,
  items: readonly T[],
  maxBytes: number = MAX_EVENT_BYTES,
): T[][] {
  const empty = bytesOf({ [field]: [] });
  const slices: T[][] = [];
  let slice: T[] = [];
  let size = empty;
  for (const item of items) {
    const itemBytes = bytesOf(item);
    if (slice.length > 0 && size + 1 + itemBytes > maxBytes) {
      slices.push(slice);
      slice = [];
      size = empty;
    }
    size += (slice.length > 0 ? 1 : 0) + itemBytes; // one comma between array items
    slice.push(item);
  }
  if (slice.length > 0) {
    slices.push(slice);
  }
  return slices;
}
