import { parse } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorCodeOf } from '@/lib/errors/graphql-error';

import { createApolloClient } from './create-apollo-client';
import { isHttpReachable, reportHttpReachable } from './network-status';

afterEach(() => {
  vi.unstubAllGlobals();
  reportHttpReachable(true);
});

function mockError(code: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ message: 'Request failed.', extensions: { code } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ),
  );
}

describe('Apollo authentication errors', () => {
  it.each(['SignUp', 'Login'])(
    '%s passes unauthenticated errors to the caller without redirecting',
    async (name) => {
      mockError('UNAUTHENTICATED');
      reportHttpReachable(false);
      const onUnauthenticated = vi.fn();
      const client = createApolloClient(onUnauthenticated);
      let error: unknown;
      try {
        await client.mutate({ mutation: parse(`mutation ${name} { account }`) });
      } catch (caught) {
        error = caught;
      }
      expect(errorCodeOf(error)).toBe('UNAUTHENTICATED');
      expect(onUnauthenticated).not.toHaveBeenCalled();
      expect(isHttpReachable()).toBe(true);
      client.stop();
    },
  );

  it('still redirects on an unauthenticated protected operation', async () => {
    mockError('UNAUTHENTICATED');
    const onUnauthenticated = vi.fn();
    const client = createApolloClient(onUnauthenticated);
    await expect(
      client.query({ query: parse('query TestProtectedSession { me }') }),
    ).rejects.toThrow();
    expect(onUnauthenticated).toHaveBeenCalledOnce();
    client.stop();
  });

  it('does not redirect on other GraphQL errors', async () => {
    mockError('BAD_USER_INPUT');
    const onUnauthenticated = vi.fn();
    const client = createApolloClient(onUnauthenticated);
    await expect(client.query({ query: parse('query TestOtherError { me }') })).rejects.toThrow();
    expect(onUnauthenticated).not.toHaveBeenCalled();
    client.stop();
  });
});
