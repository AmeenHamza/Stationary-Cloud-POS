import { once } from 'node:events';
import net from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createTcpProxy, type TcpProxy } from './tcp-proxy.js';

/** Echo server on a random local port. */
async function echoServer(): Promise<{ port: number; close: () => void }> {
  const server = net.createServer((socket) => socket.pipe(socket));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { port: (server.address() as net.AddressInfo).port, close: () => server.close() };
}

/** Sends `text` through `port` and resolves with the echo, or with the socket error code. */
async function roundTrip(port: number, text: string): Promise<string> {
  const socket = net.connect(port, '127.0.0.1');
  return new Promise((resolve) => {
    let received = '';
    socket.on('data', (chunk: Buffer) => {
      received += chunk.toString();
      if (received.length >= text.length) {
        socket.end();
        resolve(received);
      }
    });
    socket.on('error', (error: NodeJS.ErrnoException) => {
      resolve(error.code ?? 'ERROR');
    });
    socket.on('close', () => {
      resolve(received === '' ? 'CLOSED' : received);
    });
    socket.write(text);
  });
}

let proxy: TcpProxy | undefined;
let echo: Awaited<ReturnType<typeof echoServer>> | undefined;

afterEach(async () => {
  await proxy?.close();
  echo?.close();
});

describe('createTcpProxy', () => {
  it('forwards traffic, refuses it while cut, and recovers on restore', async () => {
    echo = await echoServer();
    proxy = await createTcpProxy(`redis://localhost:${String(echo.port)}`);
    expect(await roundTrip(proxy.port, 'ping')).toBe('ping');

    proxy.cut();
    expect(['CLOSED', 'ECONNRESET']).toContain(await roundTrip(proxy.port, 'ping'));

    proxy.restore();
    expect(await roundTrip(proxy.port, 'pong')).toBe('pong');
  });

  it('holds traffic while stalled and delivers it in order on restore', async () => {
    echo = await echoServer();
    proxy = await createTcpProxy(`redis://localhost:${String(echo.port)}`);
    proxy.stall();
    let settled = false;
    const pending = roundTrip(proxy.port, 'held').then((value) => {
      settled = true;
      return value;
    });
    await roundTrip(echo.port, 'direct'); // a full round trip elsewhere; the stalled one must wait
    expect(settled).toBe(false);
    proxy.restore();
    expect(await pending).toBe('held');
  });

  it('rewrites URLs to point at the proxy, keeping credentials and path', async () => {
    echo = await echoServer();
    proxy = await createTcpProxy(`postgresql://localhost:${String(echo.port)}`);
    const wrapped = new URL(proxy.wrap('postgresql://pos:pw@localhost:5432/pos_dev?schema=x'));
    expect(wrapped.host).toBe(`127.0.0.1:${String(proxy.port)}`);
    expect(wrapped.username).toBe('pos');
    expect(wrapped.pathname).toBe('/pos_dev');
    expect(wrapped.search).toBe('?schema=x');
  });

  it('refuses non-local targets', async () => {
    await expect(createTcpProxy('redis://example.com:6379')).rejects.toThrow(/non-local/);
  });
});
