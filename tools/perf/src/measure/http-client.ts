import { getOperationAST, Kind, print, visit, type DocumentNode, type FieldNode } from 'graphql';

import type { DbMeter } from './pg-byte-proxy.js';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

/** Per operation: requests, JSON bytes (M2 uncompressed, M4) and the database bytes each caused (M1). */
export interface OperationStats {
  count: number;
  received: number;
  largest: number;
  dbBytes: number;
}

export class HttpMeter {
  requests = 0;
  sent = 0;
  received = 0;
  readonly byOperation = new Map<string, OperationStats>();

  record(operation: string, sent: number, received: number, dbBytes: number): void {
    this.requests += 1;
    this.sent += sent;
    this.received += received;
    const entry = this.byOperation.get(operation) ?? {
      count: 0,
      received: 0,
      largest: 0,
      dbBytes: 0,
    };
    entry.count += 1;
    entry.received += received;
    entry.largest = Math.max(entry.largest, received);
    entry.dbBytes += dbBytes;
    this.byOperation.set(operation, entry);
  }
}

const printed = new WeakMap<object, { query: string; name: string }>();

const TYPENAME: FieldNode = { kind: Kind.FIELD, name: { kind: Kind.NAME, value: '__typename' } };

/** Adds `__typename` to every nested selection set, as Apollo's cache does before sending. */
function withTypenames(document: DocumentNode): DocumentNode {
  return visit(document, {
    SelectionSet(node, _key, parent) {
      const root = (parent as { kind?: string } | undefined)?.kind === Kind.OPERATION_DEFINITION;
      const has = node.selections.some(
        (selection) => selection.kind === Kind.FIELD && selection.name.value === '__typename',
      );
      return root || has ? undefined : { ...node, selections: [...node.selections, TYPENAME] };
    },
  });
}

function textOf(document: TypedDocumentNode<unknown, unknown>): { query: string; name: string } {
  const known = printed.get(document);
  if (known !== undefined) {
    return known;
  }
  const entry = {
    query: print(withTypenames(document)),
    name: getOperationAST(document)?.name?.value ?? 'anonymous',
  };
  printed.set(document, entry);
  return entry;
}

/**
 * One signed-in browser tab, as seen by the API: the session cookie, JSON POSTs of the web app's
 * own documents, and the meters. GraphQL errors throw, so a broken scenario never measures silently.
 */
export class GraphqlSession {
  private cookie = '';

  constructor(
    private readonly url: string,
    private readonly origin: string,
    readonly meter: HttpMeter,
    /** Requests run one at a time, so the bytes between start and end belong to this request. */
    private readonly db: DbMeter,
  ) {}

  async run<TData, TVariables>(
    document: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
  ): Promise<TData> {
    const { query, name } = textOf(document as TypedDocumentNode<unknown, unknown>);
    const body = JSON.stringify({ operationName: name, query, variables });
    const dbBefore = this.db.bytes;
    const response = await fetch(`${this.url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: this.origin, cookie: this.cookie },
      body,
    });
    const text = await response.text();
    this.meter.record(
      name,
      Buffer.byteLength(body),
      Buffer.byteLength(text),
      this.db.bytes - dbBefore,
    );
    const setCookie = response.headers.get('set-cookie');
    if (setCookie !== null) {
      this.cookie = setCookie.split(';')[0] ?? '';
    }
    const payload = JSON.parse(text) as { data?: TData; errors?: unknown[] };
    if (payload.errors !== undefined || payload.data === undefined) {
      throw new Error(`${name} failed: ${JSON.stringify(payload.errors)}`);
    }
    return payload.data;
  }

  get sessionCookie(): string {
    return this.cookie;
  }
}
