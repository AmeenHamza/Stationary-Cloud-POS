import { createStatementCounter, createTcpProxy, type TcpProxy } from '@pos/testkit';

/** Bytes both ways between the API and PostgreSQL, and statements sent (M1, NETWORK_OPTIMIZATION.md §1). */
export interface DbMeter {
  readonly bytes: number;
  readonly statements: number;
  /** Starts a new measurement window and returns the totals of the one that ended. */
  take: () => { bytes: number; statements: number };
}

/** A TCP proxy in front of PostgreSQL that counts every byte the API sends and receives. */
export async function startPgByteProxy(databaseUrl: string): Promise<{
  proxy: TcpProxy;
  meter: DbMeter;
}> {
  let bytes = 0;
  const statements = createStatementCounter();
  const proxy = await createTcpProxy(databaseUrl, {
    onClientData: (connection, chunk) => {
      statements.feed(connection, chunk);
      bytes += chunk.length;
    },
    onServerData: (_connection, chunk) => {
      bytes += chunk.length;
    },
  });
  const meter: DbMeter = {
    get bytes() {
      return bytes;
    },
    get statements() {
      return statements.count;
    },
    take: () => {
      const window = { bytes, statements: statements.count };
      bytes = 0;
      statements.reset();
      return window;
    },
  };
  return { proxy, meter };
}
