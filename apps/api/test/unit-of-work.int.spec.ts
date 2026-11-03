import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TransactionalClient } from '../src/infrastructure/prisma/transactional-client';
import { channelFor } from '../src/infrastructure/realtime/channels';
import { OutboxService } from '../src/infrastructure/realtime/outbox.service';
import { UnitOfWork } from '../src/infrastructure/unit-of-work/unit-of-work';

import { listenTo, type ChannelListener } from './support/channel-listener';
import { startHarness, type Harness } from './support/harness';

let h: Harness;
let uow: UnitOfWork;
let outbox: OutboxService;
let db: TransactionalClient;
let staff: ChannelListener;

beforeAll(async () => {
  h = await startHarness();
  uow = h.app.get(UnitOfWork);
  outbox = h.app.get(OutboxService);
  db = h.app.get(TransactionalClient);
  staff = await listenTo([channelFor('staff')]);
});

afterAll(async () => {
  await staff.close();
  await h.stop();
});

const outboxCount = async (): Promise<number> => {
  const rows = await db.client.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM outbox_events`;
  return Number(rows[0]?.n ?? 0n);
};

const settingsChanged = (marker: string) => outbox.add('settings.changed', 'staff', { marker });

describe('UnitOfWork', () => {
  it('commits, then publishes the outbox event (outbox round trip)', async () => {
    await uow.run(() => settingsChanged('commit'));
    const message = JSON.parse(await staff.next()) as { type: string; payload: { marker: string } };
    expect(message).toMatchObject({ type: 'settings.changed', payload: { marker: 'commit' } });
    const [row] = await db.client.$queryRaw<{ published: boolean }[]>`
      SELECT published_at IS NOT NULL AS published FROM outbox_events ORDER BY seq DESC LIMIT 1`;
    expect(row?.published).toBe(true);
  });

  it('rolls back everything, including the event, when the work throws', async () => {
    const before = await outboxCount();
    await expect(
      uow.run(async () => {
        await settingsChanged('rolled-back');
        throw new Error('stock check failed');
      }),
    ).rejects.toThrow('stock check failed');
    expect(await outboxCount()).toBe(before);
    await uow.run(() => settingsChanged('sentinel'));
    expect(await staff.next()).toContain('sentinel'); // the rolled-back event was never published
  });

  it('retries the whole transaction after a serialization failure', async () => {
    const before = await outboxCount();
    let attempts = 0;
    await uow.run(async () => {
      attempts += 1;
      await settingsChanged(`attempt-${String(attempts)}`);
      if (attempts === 1) {
        throw Object.assign(new Error('could not serialize access'), { code: 'P2034' });
      }
    });
    expect(attempts).toBe(2);
    expect(await outboxCount()).toBe(before + 1);
    expect(await staff.next()).toContain('attempt-2');
  });

  it('recovers from a real PostgreSQL deadlock (40P01) by retrying', async () => {
    const seqs = await db.client.$queryRaw<{ seq: bigint }[]>`
      SELECT seq FROM outbox_events ORDER BY seq LIMIT 2`;
    const [a, b] = seqs.map((row) => row.seq);
    if (a === undefined || b === undefined) {
      throw new Error('fixture needs two outbox rows');
    }
    let attempts = 0;
    let arrived = 0;
    let releaseBoth: () => void = () => undefined;
    const bothLocked = new Promise<void>((resolve) => (releaseBoth = resolve));
    const lockInOrder = (first: bigint, second: bigint) =>
      uow.run(async () => {
        attempts += 1;
        await db.client.$executeRaw`UPDATE outbox_events SET type = type WHERE seq = ${first}`;
        arrived += 1;
        if (arrived === 2) releaseBoth();
        await bothLocked;
        await db.client.$executeRaw`UPDATE outbox_events SET type = type WHERE seq = ${second}`;
      });
    await Promise.all([lockInOrder(a, b), lockInOrder(b, a)]);
    expect(attempts).toBe(3); // one of the two was chosen as the deadlock victim and re-ran
  });

  it('sets local lock and statement timeouts (DATABASE.md §6)', async () => {
    const settings = await uow.run(
      () =>
        db.client.$queryRaw<{ lock: string; statement: string }[]>`
        SELECT current_setting('lock_timeout') AS lock, current_setting('statement_timeout') AS statement`,
    );
    expect(settings[0]).toEqual({ lock: '3s', statement: '10s' });
  });

  it('nested runs join the outer transaction', async () => {
    const before = await outboxCount();
    await expect(
      uow.run(async () => {
        await uow.run(() => settingsChanged('inner'));
        throw new Error('outer fails');
      }),
    ).rejects.toThrow('outer fails');
    expect(await outboxCount()).toBe(before);
  });
});

describe('OutboxService guards', () => {
  it('refuses events outside a transaction, to the wrong audience, or over 1 KB', async () => {
    await expect(settingsChanged('outside')).rejects.toThrow(/inside UnitOfWork/);
    await expect(uow.run(() => outbox.add('order.created', 'staff', {}))).rejects.toThrow(
      /audience/,
    );
    await expect(
      uow.run(() => outbox.add('settings.changed', 'staff', { blob: 'x'.repeat(1_100) })),
    ).rejects.toThrow(/max 1024/);
  });
});
