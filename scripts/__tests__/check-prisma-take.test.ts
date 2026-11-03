import { describe, expect, it } from 'vitest';

import { checkPrismaSource } from '../check-prisma-take.js';

describe('checkPrismaSource', () => {
  it('requires take on findMany unless a bounded reason is given', () => {
    const source = [
      'a.product.findMany({ where: {}, take: first + 1 });',
      'b.product.findMany({ where: { id: { in: ids } } });',
      '// bounded: ids are capped at 50 by validation',
      'c.product.findMany({ where: { id: { in: ids } } });',
    ].join('\n');
    const findings = checkPrismaSource('repo.ts', source);
    expect(findings.map((f) => [f.rule, f.line])).toEqual([['findMany-take', 2]]);
  });

  it('accepts shorthand properties (`take,` / `select }`) but not lookalikes', () => {
    const source = [
      'a.user.findMany({ where, take, select: S });',
      'b.user.update({ where, data, select });',
      'c.user.findMany({ where: { mistake: 1 } });',
    ].join('\n');
    const findings = checkPrismaSource('repo.ts', source);
    expect(findings.map((f) => [f.rule, f.line])).toEqual([['findMany-take', 3]]);
  });

  it('requires select on single-row writes but not on bulk writes', () => {
    const source = [
      'a.product.update({ where: { id }, data, select: { id: true } });',
      'b.product.update({ where: { id }, data });',
      'c.product.createMany({ data: rows });',
      'd.product.create({ data: { name: fn(x) } });',
    ].join('\n');
    const rules = checkPrismaSource('repo.ts', source).map((f) => [f.rule, f.line]);
    expect(rules).toEqual([
      ['write-select', 2],
      ['write-select', 4],
    ]);
  });

  it('ignores non-Prisma calls such as Map/Set delete, but still flags Prisma deletes', () => {
    const source = [
      'this.inFlight.delete(key);',
      'set?.delete(handler);',
      'tx.session.delete({ where: { id } });',
    ].join('\n');
    expect(checkPrismaSource('repo.ts', source).map((f) => [f.rule, f.line])).toEqual([
      ['write-select', 3],
    ]);
  });

  it('handles nested parentheses inside the arguments', () => {
    const source = 'x.order.findMany({ where: f(g(1)), take: limit(2) });';
    expect(checkPrismaSource('repo.ts', source)).toEqual([]);
  });
});
