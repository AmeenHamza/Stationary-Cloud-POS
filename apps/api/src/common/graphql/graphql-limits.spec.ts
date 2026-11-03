import { buildSchema, parse, validate, type GraphQLSchema } from 'graphql';
import { getComplexity } from 'graphql-query-complexity';
import { describe, expect, it } from 'vitest';

import { COMPLEXITY_ESTIMATORS, complexityPlugin } from './complexity.plugin';
import { depthLimitRule } from './depth-limit.rule';

const schema = buildSchema(`
  type Query { node: Node, list(first: Int): [Node!]! }
  type Node { name: String, child: Node, items(first: Int): [Node!]! }
`);

/** `{ node { child { … { name } } } }` with `levels` field levels in total. */
function nested(levels: number): string {
  return `{ node ${'{ child '.repeat(levels - 2)}{ name }${' }'.repeat(levels - 2)} }`;
}

const depthErrors = (query: string, max: number): string[] =>
  validate(schema, parse(query), [depthLimitRule(max)]).map((error) => error.message);

describe('depthLimitRule', () => {
  it('allows operations at the limit and rejects deeper ones', () => {
    expect(depthErrors(nested(10), 10)).toEqual([]);
    expect(depthErrors(nested(11), 10)).toEqual(['Query depth 11 exceeds the limit of 10.']);
  });

  it('counts fields reached through fragments and inline fragments', () => {
    const query = `
      query { node { ...Deep } }
      fragment Deep on Node { child { ... on Node { child { name } } } }`;
    expect(depthErrors(query, 3)).toEqual(['Query depth 4 exceeds the limit of 3.']);
  });

  it('terminates on fragment cycles (reported by the standard rules, not here)', () => {
    const query = `query { node { ...A } } fragment A on Node { child { ...A } }`;
    expect(depthErrors(query, 10)).toEqual([]);
  });
});

function complexityOf(query: string, target: GraphQLSchema = schema): number {
  return getComplexity({
    schema: target,
    query: parse(query),
    variables: {},
    estimators: [...COMPLEXITY_ESTIMATORS],
  });
}

describe('complexity', () => {
  it('charges list fields first × child cost', () => {
    expect(complexityOf('{ list(first: 50) { child { name } } }')).toBe(1 + 50 * 1);
    expect(
      complexityOf('{ list(first: 50) { child { name } items(first: 10) { child { name } } } }'),
    ).toBe(1 + 50 * (1 + (1 + 10 * 1)));
  });

  it('charges object fields 1 and scalar fields nothing (a full page of rows stays cheap)', () => {
    expect(complexityOf('{ node { name child { name } } }')).toBe(2);
    expect(complexityOf('{ list(first: 50) { __typename name } }')).toBe(1);
  });

  it('the plugin rejects operations over the limit as BAD_USER_INPUT', async () => {
    const run = async (query: string, max: number, variables = {}): Promise<void> => {
      const hooks = await complexityPlugin(max).requestDidStart?.({} as never);
      await hooks?.didResolveOperation?.({
        request: { variables },
        document: parse(query),
        schema,
      } as never);
    };
    await expect(run('{ list(first: 50) { child { name } } }', 100)).resolves.toBeUndefined();
    await expect(run('{ list(first: 50) { child { name } } }', 50)).rejects.toMatchObject({
      message: 'Query complexity 51 exceeds the limit of 50.',
      extensions: { code: 'BAD_USER_INPUT' },
    });
    // Invalid variables are the caller's mistake, never an internal error.
    const withVariable = 'query Q($first: Int!) { list(first: $first) { name } }';
    await expect(run(withVariable, 100, { first: null })).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });
  });
});
