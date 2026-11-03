import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { MetricsService } from '../src/infrastructure/metrics/metrics.service';
import { channelFor } from '../src/infrastructure/realtime/channels';
import { OutboxPublisher } from '../src/infrastructure/realtime/outbox.publisher';
import { OutboxService } from '../src/infrastructure/realtime/outbox.service';
import { RedisPubSub } from '../src/infrastructure/realtime/redis-pubsub';
import { UnitOfWork } from '../src/infrastructure/unit-of-work/unit-of-work';

import { listenTo, type ChannelListener } from './support/channel-listener';
import { startHarness, type Harness } from './support/harness';
import { createFileDatabase, within } from './support/services';

import type { TestDatabase } from '@pos/testkit';

let db: TestDatabase;
let staff: ChannelListener;

beforeAll(async () => {
  db = await createFileDatabase();
  staff = await listenTo([channelFor('staff')]);
});

afterAll(async () => {
  await staff.close();
  await db.drop();
});

const addEvent = (h: Harness, marker: string): Promise<void> =>
  h.app
    .get(UnitOfWork)
    .run(() => h.app.get(OutboxService).add('settings.changed', 'staff', { marker }));

const unpublished = async (): Promise<number> => {
  const rows = await querySql<{ n: string }>(
    db.url,
    'SELECT count(*)::text AS n FROM outbox_events WHERE published_at IS NULL',
  );
  return Number(rows[0]?.n);
};

const failures = async (h: Harness): Promise<number> =>
  (await h.app.get(MetricsService).outboxPublishFailures.get()).values[0]?.value ?? 0;

describe('outbox with Redis outages (RED-01/RED-02 infrastructure, RT-04)', () => {
  it('commits while Redis is down, then drains on reconnect', async () => {
    const h = await startHarness({ db });
    try {
      // Let the startup drain finish first: if it were still running when the event is added, it
      // could claim the row, fail to publish and count a second failure.
      await h.app.get(OutboxPublisher).drain();
      await h.cutRedis();
      await addEvent(h, 'while-down'); // the business write never fails because of Redis
      expect(await unpublished()).toBe(1);
      expect(await failures(h)).toBe(1);

      h.redisProxy.restore();
      expect(await staff.next(15_000)).toContain('while-down');
      await h.app.get(OutboxPublisher).drain(); // joins the in-flight drain until it has committed
      expect(await unpublished()).toBe(0);
    } finally {
      await h.stop();
    }
  });

  it('drains rows left unpublished by a crashed instance when the next one starts', async () => {
    await querySql(
      db.url,
      `INSERT INTO outbox_events (type, audience, schema_version, payload)
       VALUES ('settings.changed', 'staff', 1, '{"marker":"from-crash"}')`,
    );
    expect(await unpublished()).toBe(1);
    const h = await startHarness({ db });
    try {
      expect(await staff.next(15_000)).toContain('from-crash');
      await h.app.get(OutboxPublisher).drain();
      expect(await unpublished()).toBe(0);
    } finally {
      await h.stop();
    }
  });
});

describe('two API instances sharing Redis (RT-03 infrastructure)', () => {
  it('an event committed on A reaches a subscriber on B', async () => {
    const a = await startHarness({ db });
    const b = await startHarness({ db });
    try {
      let resolveMessage: (message: string) => void = () => undefined;
      const received = new Promise<string>((resolve) => (resolveMessage = resolve));
      const unsubscribe = await b.app
        .get(RedisPubSub)
        .subscribe([channelFor('staff')], resolveMessage);
      const started = Date.now();
      await addEvent(a, 'cross-instance');
      expect(await within(received, 1_000, 'cross-instance event')).toContain('cross-instance');
      expect(Date.now() - started).toBeLessThan(1_000);
      await unsubscribe();
    } finally {
      await Promise.all([a.stop(), b.stop()]);
    }
  });
});
