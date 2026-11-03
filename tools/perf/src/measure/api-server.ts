import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { startPgByteProxy, type DbMeter } from './pg-byte-proxy.js';

export interface PerfApi {
  url: string;
  db: DbMeter;
  stop: () => Promise<void>;
}

const PORT = 4200;
const WEB_ORIGIN = 'http://localhost:3200';
const READY_ATTEMPTS = 120;

/**
 * The built API (`apps/api/dist`, production mode) with its database connection through the byte
 * proxy, as in production but on local services. Logs at `warn`; build the API first.
 */
export async function startPerfApi(
  repoRoot: string,
  databaseUrl: string,
  redisUrl: string,
): Promise<PerfApi> {
  const { proxy, meter } = await startPgByteProxy(databaseUrl);
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(repoRoot, 'apps', 'api'),
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      LOG_LEVEL: 'warn',
      DATABASE_URL: proxy.wrap(databaseUrl),
      REDIS_URL: redisUrl,
      WEB_ORIGIN,
      TRUST_PROXY_HOPS: '0',
      SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      METRICS_TOKEN: randomBytes(24).toString('hex'),
    },
  });
  const url = `http://127.0.0.1:${String(PORT)}`;
  for (let attempt = 1; ; attempt += 1) {
    const ready = await fetch(`${url}/health/ready`).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      break;
    }
    if (attempt >= READY_ATTEMPTS || api.exitCode !== null) {
      api.kill();
      throw new Error('the API did not become ready (is apps/api built?)');
    }
    await sleep(500); // start-up wait, not polling of business data
  }
  return {
    url,
    db: meter,
    stop: async () => {
      api.kill();
      await new Promise((resolve) => api.once('exit', resolve));
      await proxy.close();
    },
  };
}

export { WEB_ORIGIN };
