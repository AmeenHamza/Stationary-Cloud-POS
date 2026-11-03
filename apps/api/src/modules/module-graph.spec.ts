import { readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { AiAssistantModule } from './ai-assistant';
import { AuditModule } from './audit';
import { AuthModule } from './auth';
import { CatalogModule } from './catalog';
import { CatalogIoModule } from './catalog-io';
import { HealthModule } from './health/health.module';
import { KhataModule } from './khata';
import { RealtimeModule } from './realtime';
import { ReportingModule } from './reporting';
import { SalesModule } from './sales';
import { ServerInfoModule } from './server-info/server-info.module';
import { SettingsModule } from './settings';
import { StaffModule } from './staff';

/** Every folder under src/modules, by folder name. A new module must be registered here. */
const MODULES: Readonly<Record<string, unknown>> = {
  'ai-assistant': AiAssistantModule,
  audit: AuditModule,
  auth: AuthModule,
  catalog: CatalogModule,
  'catalog-io': CatalogIoModule,
  health: HealthModule,
  khata: KhataModule,
  realtime: RealtimeModule,
  reporting: ReportingModule,
  sales: SalesModule,
  'server-info': ServerInfoModule,
  settings: SettingsModule,
  staff: StaffModule,
};

const AUDITED = [
  'sales',
  'catalog',
  'khata',
  'settings',
  'staff',
  'catalog-io',
  'ai-assistant',
  'auth',
];

/** Allowed edges between business modules: ARCHITECTURE.md §7.1 (from → to). */
const DOCUMENTED_EDGES: readonly (readonly [string, string])[] = [
  ['sales', 'catalog'],
  ['sales', 'khata'],
  ['sales', 'settings'],
  ['catalog-io', 'catalog'],
  ['ai-assistant', 'reporting'],
  ['ai-assistant', 'settings'],
  ['staff', 'auth'],
  ['realtime', 'auth'],
  ...AUDITED.map((from) => [from, 'audit'] as const),
];

function importsOf(module: unknown): unknown[] {
  const imports: unknown = Reflect.getMetadata('imports', module as object);
  return Array.isArray(imports) ? imports : [];
}

function actualEdges(): string[] {
  const nameOf = new Map(Object.entries(MODULES).map(([name, module]) => [module, name]));
  return Object.entries(MODULES)
    .flatMap(([from, module]) =>
      importsOf(module)
        .map((imported) => nameOf.get(imported)) // infrastructure imports are not business edges
        .filter((to): to is string => to !== undefined)
        .map((to) => `${from} → ${to}`),
    )
    .sort();
}

describe('ARCH-01: Nest module graph (CODING_STANDARDS.md §4)', () => {
  it('registers every module folder', () => {
    const folders = readdirSync(__dirname, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(Object.keys(MODULES).sort());
  });

  it('has exactly the documented edges between existing modules', () => {
    const present = new Set(Object.keys(MODULES));
    const expected = DOCUMENTED_EDGES.filter(([from, to]) => present.has(from) && present.has(to))
      .map(([from, to]) => `${from} → ${to}`)
      .sort();
    expect(actualEdges()).toEqual(expected);
  });
});
