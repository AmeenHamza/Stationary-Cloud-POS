import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildSchema,
  getNamedType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
  type GraphQLOutputType,
} from 'graphql';

import { REPO_ROOT, argValue, isMainModule } from './lib/repo.js';
import { finish, type Finding } from './lib/report.js';

export interface AllowEntry {
  field: string;
  bound: number;
  reason: string;
}

const SCHEMA_PATH = 'packages/contracts/schema.graphql';

interface FieldLike {
  name: string;
  type: GraphQLOutputType;
  args: readonly { name: string }[];
}

type FieldKind = 'connection' | 'object-list' | 'other';

function unwrapNonNull(type: GraphQLOutputType): GraphQLOutputType {
  return isNonNullType(type) ? type.ofType : type;
}

function classify(typeName: string, field: FieldLike): FieldKind {
  const named = getNamedType(field.type);
  if (named.name.endsWith('Connection')) {
    return 'connection';
  }
  if (typeName.endsWith('Connection') && field.name === 'nodes') {
    return 'other';
  }
  const objectNamed = isObjectType(named) || isInterfaceType(named) || isUnionType(named);
  return objectNamed && isListType(unwrapNonNull(field.type)) ? 'object-list' : 'other';
}

/** Yields `Type.field` keys with their field for every object and interface type. */
function* schemaFields(sdl: string): Generator<[string, string, FieldLike]> {
  for (const type of Object.values(buildSchema(sdl).getTypeMap())) {
    if (!type.name.startsWith('__') && (isObjectType(type) || isInterfaceType(type))) {
      for (const field of Object.values(type.getFields())) {
        yield [`${type.name}.${field.name}`, type.name, field];
      }
    }
  }
}

function allowListFindings(allow: readonly AllowEntry[], seen: Set<string>): Finding[] {
  return allow.flatMap((entry) => {
    const findings: Finding[] = [];
    if (!seen.has(entry.field)) {
      findings.push({
        file: SCHEMA_PATH,
        rule: 'stale-allowlist',
        detail: `allow-list entry ${entry.field} matches no list field (stale)`,
      });
    }
    if (entry.bound < 1 || entry.reason.trim() === '') {
      findings.push({
        file: SCHEMA_PATH,
        rule: 'allowlist-entry',
        detail: `allow-list entry ${entry.field} needs a positive bound and a reason`,
      });
    }
    return findings;
  });
}

/**
 * Every list of objects must be a `*Connection` (taking `first` and `after`) or an
 * allow-listed bounded list (API.md §3, CODING_STANDARDS.md §7).
 */
export function checkPagination(sdl: string, allow: readonly AllowEntry[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const allowed = new Set(allow.map((entry) => entry.field));
  for (const [key, typeName, field] of schemaFields(sdl)) {
    const kind = classify(typeName, field);
    const args = new Set(field.args.map((arg) => arg.name));
    if (kind === 'connection' && !(args.has('first') && args.has('after'))) {
      findings.push({
        file: SCHEMA_PATH,
        rule: 'connection-args',
        detail: `${key} returns a connection but does not accept first and after`,
      });
    }
    if (kind === 'object-list') {
      seen.add(key);
      if (!allowed.has(key)) {
        findings.push({
          file: SCHEMA_PATH,
          rule: 'unbounded-list',
          detail: `${key} is an unpaginated list; use a Connection or allow-list it with a bound`,
        });
      }
    }
  }
  return [...findings, ...allowListFindings(allow, seen)];
}

if (isMainModule(import.meta.url)) {
  const root = argValue('--root') ?? REPO_ROOT;
  const schemaFile = path.join(root, SCHEMA_PATH);
  if (existsSync(schemaFile)) {
    const raw = await readFile(new URL('./pagination-allowlist.json', import.meta.url), 'utf8');
    const { entries } = JSON.parse(raw) as { entries: AllowEntry[] };
    const findings = checkPagination(await readFile(schemaFile, 'utf8'), entries);
    process.exitCode = finish('check:graphql-pagination', findings);
  } else {
    console.log(`check:graphql-pagination: not applicable yet (${SCHEMA_PATH} does not exist)`);
  }
}
