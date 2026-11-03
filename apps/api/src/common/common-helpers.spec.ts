import { describe, expect, it } from 'vitest';

import { canonicalJson, requestHash } from './idempotency/request-hash';
import { assignedRequestId, requestIdOf } from './logging/request-id';

import type { IncomingMessage } from 'node:http';

describe('canonicalJson / requestHash (ADR-015)', () => {
  it('serializes objects with sorted keys at every level and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: undefined } })).toBe('{"a":{"d":[2,1]},"b":1}');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson(null)).toBe('null');
  });

  it('hashes equal payloads equally regardless of key order or idempotency key', () => {
    const first = requestHash({ idempotencyKey: 'k1', lines: [{ id: 'a', qty: 2 }], note: 'x' });
    const second = requestHash({ note: 'x', lines: [{ qty: 2, id: 'a' }], idempotencyKey: 'k2' });
    expect(first.equals(second)).toBe(true);
    expect(first).toHaveLength(32);
  });

  it('distinguishes different payloads, including array order', () => {
    const base = requestHash({ lines: ['a', 'b'] });
    expect(base.equals(requestHash({ lines: ['b', 'a'] }))).toBe(false);
    expect(base.equals(requestHash({ lines: ['a', 'b'], note: '' }))).toBe(false);
  });
});

describe('request ids', () => {
  const request = (header?: string | string[]): IncomingMessage =>
    ({ headers: header === undefined ? {} : { 'x-request-id': header } }) as IncomingMessage;
  const UUID = /^[0-9a-f-]{36}$/;

  it('reuses a well-formed incoming x-request-id', () => {
    expect(requestIdOf(request('edge-req_0123456789'))).toBe('edge-req_0123456789');
  });

  it.each([undefined, 'short', 'has spaces in it', 'x'.repeat(65), ['a-list-value-1']])(
    'generates a new id instead of %j',
    (header) => {
      expect(requestIdOf(request(header))).toMatch(UUID);
    },
  );

  it('reads the id assigned by pino-http, or generates one', () => {
    expect(assignedRequestId({ id: 'abc-123' })).toBe('abc-123');
    expect(assignedRequestId({ id: 42 })).toMatch(UUID);
    expect(assignedRequestId({})).toMatch(UUID);
  });
});
