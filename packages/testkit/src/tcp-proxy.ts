import net from 'node:net';

import { assertLocalUrl } from './env.js';

export interface TcpProxy {
  readonly port: number;
  /** `url` with its host and port pointed at the proxy. */
  wrap: (url: string) => string;
  /** Drops every open connection and refuses new ones until `restore()` (simulated outage). */
  cut: () => void;
  /** Keeps connections open but holds all traffic until `restore()` (simulated latency). */
  stall: () => void;
  restore: () => void;
  close: () => Promise<void>;
}

const DEFAULT_PORTS: Readonly<Record<string, number>> = {
  'postgres:': 5432,
  'postgresql:': 5432,
  'redis:': 6379,
};

function targetOf(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  const port = parsed.port === '' ? DEFAULT_PORTS[parsed.protocol] : Number(parsed.port);
  if (port === undefined) {
    throw new Error(`No default port for ${parsed.protocol}`);
  }
  return { host: parsed.hostname.replace(/^\[|\]$/g, ''), port };
}

export interface TcpProxyOptions {
  /** Observes bytes each client connection sends upstream (e.g. a statement counter). */
  onClientData?: (connection: number, chunk: Buffer) => void;
  /** Observes bytes the server sends back on each connection (e.g. a transfer counter). */
  onServerData?: (connection: number, chunk: Buffer) => void;
}

/** `url` with its host and port pointed at the local proxy port. */
function wrapUrl(url: string, port: number): string {
  const parsed = new URL(url);
  parsed.hostname = '127.0.0.1';
  parsed.port = String(port);
  return parsed.toString();
}

/** Reports each chunk a socket receives to `listener`, if there is one. */
function observe(
  socket: net.Socket,
  connection: number,
  listener: ((connection: number, chunk: Buffer) => void) | undefined,
): void {
  if (listener !== undefined) {
    socket.on('data', (chunk: Buffer) => {
      listener(connection, chunk);
    });
  }
}

/** Closing or failing either side closes both. */
function linkLifetimes(client: net.Socket, upstream: net.Socket): void {
  const end = (): void => {
    client.destroy();
    upstream.destroy();
  };
  for (const socket of [client, upstream]) {
    socket.on('error', end);
    socket.on('close', end);
  }
}

/**
 * Local TCP proxy for outage tests (TESTING.md §2): the API connects to PostgreSQL or Redis
 * through it, and a test cuts and restores the link without touching the real service.
 */
export async function createTcpProxy(
  targetUrl: string,
  options: TcpProxyOptions = {},
): Promise<TcpProxy> {
  assertLocalUrl(targetUrl);
  const target = targetOf(targetUrl);
  const sockets = new Set<net.Socket>();
  const held: (() => void)[] = [];
  let mode: 'open' | 'cut' | 'stalled' = 'open';
  let connections = 0;

  const track = (socket: net.Socket): void => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  };
  const dropAll = (): void => {
    for (const socket of sockets) {
      socket.destroy();
    }
  };

  const forward = (from: net.Socket, to: net.Socket): void => {
    from.on('data', (chunk: Buffer) => {
      if (mode === 'stalled') {
        held.push(() => to.write(chunk));
      } else {
        to.write(chunk);
      }
    });
  };

  const server = net.createServer((client) => {
    track(client);
    if (mode === 'cut') {
      client.destroy();
      return;
    }
    const upstream = net.connect(target.port, target.host);
    track(upstream);
    const connection = (connections += 1);
    observe(client, connection, options.onClientData);
    observe(upstream, connection, options.onServerData);
    linkLifetimes(client, upstream);
    forward(client, upstream);
    forward(upstream, client);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    port,
    wrap: (url) => wrapUrl(url, port),
    cut: () => {
      mode = 'cut';
      held.length = 0;
      dropAll();
    },
    stall: () => {
      mode = 'stalled';
    },
    restore: () => {
      mode = 'open';
      for (const release of held.splice(0)) {
        release();
      }
    },
    close: () =>
      new Promise<void>((resolve) => {
        mode = 'cut';
        dropAll();
        server.close(() => {
          resolve();
        });
      }),
  };
}
