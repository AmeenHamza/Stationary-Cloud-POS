/**
 * Counts SQL statements a client sends to PostgreSQL by reading the frontend protocol stream
 * (TESTING.md NET-02, PAG-07): each simple `Query` ('Q') and each extended-protocol `Execute`
 * ('E') is one statement. Startup, SSL and GSS negotiation messages have no type byte and are
 * skipped. Plain-text local connections only (the proxy refuses non-local targets).
 */
export interface StatementCounter {
  /** Statements seen since the last reset. */
  readonly count: number;
  reset: () => void;
  /** Feed bytes the client sent on one connection (the proxy's client → server direction). */
  feed: (connection: number, chunk: Buffer) => void;
}

const NEGOTIATION_CODES = new Set([80877103, 80877104]); // SSLRequest, GSSENCRequest
const STATEMENT_TYPES = new Set(['Q'.charCodeAt(0), 'E'.charCodeAt(0)]);

interface ConnectionState {
  buffer: Buffer;
  started: boolean;
}

export function createStatementCounter(): StatementCounter {
  const connections = new Map<number, ConnectionState>();
  let count = 0;

  /** Consumes every complete message in the buffer; returns what is left. */
  const consume = (state: ConnectionState): void => {
    for (;;) {
      if (!state.started) {
        if (state.buffer.length < 8) return;
        const length = state.buffer.readInt32BE(0);
        if (state.buffer.length < length) return;
        const code = state.buffer.readInt32BE(4);
        state.started = !NEGOTIATION_CODES.has(code); // the startup message follows a negotiation
        state.buffer = state.buffer.subarray(length);
        continue;
      }
      if (state.buffer.length < 5) return;
      const length = state.buffer.readInt32BE(1) + 1;
      if (state.buffer.length < length) return;
      if (STATEMENT_TYPES.has(state.buffer[0] ?? 0)) {
        count += 1;
      }
      state.buffer = state.buffer.subarray(length);
    }
  };

  return {
    get count() {
      return count;
    },
    reset: () => {
      count = 0;
    },
    feed: (connection, chunk) => {
      const state = connections.get(connection) ?? { buffer: Buffer.alloc(0), started: false };
      state.buffer = Buffer.concat([state.buffer, chunk]);
      connections.set(connection, state);
      consume(state);
    },
  };
}
