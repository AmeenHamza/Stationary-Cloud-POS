import { Inject, Injectable } from '@nestjs/common';

import { PRISMA_CLIENT, type AppPrismaClient } from '../prisma/prisma.module';
import { TransactionalClient } from '../prisma/transactional-client';

import type { Prisma } from '@pos/database';

export interface OutboxRow {
  seq: bigint;
  type: string;
  audience: string;
  schemaVersion: number;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

const ROW_SELECT = {
  seq: true,
  type: true,
  audience: true,
  schemaVersion: true,
  payload: true,
  createdAt: true,
} as const;

type Client = Pick<Prisma.TransactionClient, 'outboxEvent' | '$queryRaw' | '$executeRaw'>;

/** Persistence for `outbox_events` (DATABASE.md §4.13, ADR-009). */
@Injectable()
export class OutboxRepository {
  constructor(
    private readonly db: TransactionalClient,
    @Inject(PRISMA_CLIENT) private readonly prisma: AppPrismaClient,
  ) {}

  /** Inserts inside the caller's transaction; the event exists only if that transaction commits. */
  async insert(event: Omit<OutboxRow, 'seq' | 'createdAt'>): Promise<bigint> {
    const row = await this.db.client.outboxEvent.create({
      data: { ...event, payload: event.payload as Prisma.InputJsonValue },
      select: { seq: true },
    });
    return row.seq;
  }

  findUnpublished(seqs: readonly bigint[]): Promise<OutboxRow[]> {
    return this.prisma.outboxEvent.findMany({
      where: { seq: { in: [...seqs] }, publishedAt: null },
      orderBy: { seq: 'asc' },
      take: seqs.length,
      select: ROW_SELECT,
    });
  }

  async markPublished(
    seqs: readonly bigint[],
    at: Date,
    client: Client = this.prisma,
  ): Promise<void> {
    await client.outboxEvent.updateMany({
      where: { seq: { in: [...seqs] }, publishedAt: null },
      data: { publishedAt: at },
    });
  }

  /** Locks a batch of unpublished rows; concurrent drains on other instances skip them. */
  async claimBatch(client: Client, limit: number): Promise<OutboxRow[]> {
    const rows = await client.$queryRaw<
      {
        seq: bigint;
        type: string;
        audience: string;
        schema_version: number;
        payload: Prisma.JsonValue;
        created_at: Date;
      }[]
    >`SELECT seq, type, audience, schema_version, payload, created_at FROM outbox_events
      WHERE published_at IS NULL ORDER BY seq LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
    return rows.map((r) => ({
      seq: r.seq,
      type: r.type,
      audience: r.audience,
      schemaVersion: r.schema_version,
      payload: r.payload,
      createdAt: r.created_at,
    }));
  }

  countUnpublished(): Promise<number> {
    return this.prisma.outboxEvent.count({ where: { publishedAt: null } });
  }

  /** Deletes published rows older than 7 days, at most 5,000 per call (prune-on-write). */
  async prune(): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM outbox_events WHERE seq IN (
      SELECT seq FROM outbox_events
      WHERE published_at IS NOT NULL AND created_at < now() - interval '7 days'
      LIMIT 5000)`;
  }

  runInTransaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx));
  }
}
