import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PRISMA_CLIENT, type AppPrismaClient } from '../src/infrastructure/prisma/prisma.module';

import { createUser, loginCookie } from './support/auth';
import { completion, csv, importEvents, upload } from './support/catalog-io';
import { startHarness, type Harness } from './support/harness';

/**
 * One API instance in this file: instances in one file share the test Redis (and the import
 * queue) but not the database, so another instance's worker could take this file's job.
 */
describe('uploads while Redis is down (RED-08, ADR-020)', () => {
  let h: Harness;
  let admin = '';
  let adminId = '';

  beforeAll(async () => {
    h = await startHarness();
    const user = await createUser(h, { username: 'red08', role: 'ADMIN' });
    adminId = user.id;
    admin = await loginCookie(h.url, user);
  });
  afterAll(async () => {
    await h.stop();
  });

  it('stages the job as QUEUED, then applies every row exactly once when Redis is back', async () => {
    const prisma = h.app.get<AppPrismaClient>(PRISMA_CLIENT);
    await h.cutRedis();
    const file = csv([
      ['Name', 'Sale price'],
      ['Queued one', '1'],
      ['Queued two', '2'],
    ]);
    const response = await upload(h.url, admin, 'queued.csv', file);
    expect(response.status).toBe(202);
    const jobId = String(response.body['importJobId']);
    expect(
      await prisma.importJob.findUnique({ where: { id: jobId }, select: { status: true } }),
    ).toEqual({
      status: 'QUEUED',
    });

    const events = await importEvents(adminId);
    h.redisProxy.restore();
    await h.redisReady();
    expect(await completion(events, jobId)).toMatchObject({ succeededRows: 2, failedRows: 0 });
    await events.close();
    expect(await prisma.product.count({ where: { name: { startsWith: 'Queued ' } } })).toBe(2);
  });
});
