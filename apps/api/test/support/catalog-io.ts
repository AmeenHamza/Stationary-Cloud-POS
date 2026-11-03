import { channelFor, userAudience } from '../../src/infrastructure/realtime/channels';

import { listenTo, type ChannelListener } from './channel-listener';
import { dataOf } from './graphql-client';
import { asUser } from './staff';

/** A REST upload as the web app sends it: multipart `file`, the session cookie, the CSRF header. */
export async function upload(
  baseUrl: string,
  cookie: string,
  fileName: string,
  content: string | Uint8Array,
  options: { csrf?: boolean } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const form = new FormData();
  form.append('file', new Blob([content]), fileName);
  const response = await fetch(`${baseUrl}/v1/imports/products`, {
    method: 'POST',
    headers: { cookie, ...(options.csrf === false ? {} : { 'x-pos-csrf': '1' }) },
    body: form,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** A REST download: status, headers and the body as bytes. */
export async function download(baseUrl: string, cookie: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie } });
  return {
    status: response.status,
    headers: response.headers,
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}

export async function userIdOf(baseUrl: string, cookie: string): Promise<string> {
  return dataOf(await asUser<{ me: { id: string } }>(baseUrl, cookie, '{ me { id } }')).me.id;
}

/** Listens on the user's channel (subscribe BEFORE uploading, so no event is missed). */
export function importEvents(userId: string): Promise<ChannelListener> {
  return listenTo([channelFor(userAudience(userId))]);
}

interface Progress {
  status: string;
  succeededRows: number;
  failedRows: number;
}

/** Resolves with the job's final counters when its `import.progressed` says COMPLETED. */
export async function completion(events: ChannelListener, jobId: string, timeoutMs = 30_000) {
  for (;;) {
    const message = await events.next(timeoutMs);
    const event = JSON.parse(message) as {
      type?: string;
      payload?: Progress & { importJobId: string };
    };
    const payload = event.payload;
    if (
      event.type === 'import.progressed' &&
      payload?.importJobId === jobId &&
      payload.status === 'COMPLETED'
    ) {
      return payload;
    }
  }
}

/** A CSV file from rows of cells (the first row is the header). */
export const csv = (rows: readonly (readonly (string | number)[])[]): string =>
  rows.map((row) => row.join(',')).join('\n');
