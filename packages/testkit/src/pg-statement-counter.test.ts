import { describe, expect, it } from 'vitest';

import { createStatementCounter } from './pg-statement-counter.js';

/** An untyped startup-phase message: int32 length, int32 code, then a body. */
function untyped(code: number, body: Buffer = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(8);
  header.writeInt32BE(8 + body.length, 0);
  header.writeInt32BE(code, 4);
  return Buffer.concat([header, body]);
}

/** A typed frontend message: type byte, int32 length (including itself), body. */
function typed(type: string, body = 'x'): Buffer {
  const payload = Buffer.from(body);
  const header = Buffer.alloc(5);
  header.write(type, 0);
  header.writeInt32BE(4 + payload.length, 1);
  return Buffer.concat([header, payload]);
}

describe('PostgreSQL statement counter (NET-02)', () => {
  it('counts Query and Execute messages after startup, across split chunks', () => {
    const counter = createStatementCounter();
    const stream = Buffer.concat([
      untyped(80877103), // SSLRequest, refused by a local server
      untyped(196608, Buffer.from('user\0pos\0\0')), // StartupMessage
      typed('p', 'sasl'), // authentication response: not a statement
      typed('Q', 'BEGIN'),
      typed('P', 'SELECT 1'), // Parse, Bind, Describe, Execute, Sync: one statement
      typed('B'),
      typed('D'),
      typed('E'),
      typed('S', ''),
    ]);
    counter.feed(1, stream.subarray(0, 7));
    counter.feed(1, stream.subarray(7, 30));
    counter.feed(1, stream.subarray(30));
    expect(counter.count).toBe(2);
  });

  it('keeps connections apart and resets', () => {
    const counter = createStatementCounter();
    counter.feed(1, untyped(196608));
    counter.feed(2, untyped(196608));
    counter.feed(1, typed('Q'));
    counter.feed(2, Buffer.concat([typed('E'), typed('E')]));
    expect(counter.count).toBe(3);
    counter.reset();
    counter.feed(2, typed('Q'));
    expect(counter.count).toBe(1);
  });
});
