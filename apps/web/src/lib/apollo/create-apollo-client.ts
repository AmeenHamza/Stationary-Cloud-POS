import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { CombinedGraphQLErrors, ServerError, ServerParseError } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { tap } from 'rxjs';

import { env } from '@/lib/env';
import { errorCodeOf } from '@/lib/errors/graphql-error';

import { reportHttpReachable } from './network-status';
import { TYPE_POLICIES } from './type-policies';

/** True when the API answered at all (any status), false for a failure at network level. */
function serverAnswered(error: unknown): boolean {
  return CombinedGraphQLErrors.is(error) || ServerError.is(error) || ServerParseError.is(error);
}

/**
 * The browser's GraphQL client (ADR-005): JSON POSTs with the session cookie (`credentials:
 * 'include'`), a normalized cache, and no polling anywhere. `onUnauthenticated` sends the user to
 * the login screen when the session ends (expiry, logout elsewhere, revocation). Every response
 * also records whether the API is reachable, which drives the offline banner (F-37).
 */
export function createApolloClient(onUnauthenticated: () => void): ApolloClient {
  const http = new HttpLink({ uri: `${env.apiUrl}/graphql`, credentials: 'include' });
  const reachability = new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      tap(() => {
        reportHttpReachable(true);
      }),
    ),
  );
  const errors = new ErrorLink(({ error, operation }) => {
    reportHttpReachable(serverAnswered(error));
    if (
      errorCodeOf(error) === 'UNAUTHENTICATED' &&
      operation.operationName !== 'Login' &&
      operation.operationName !== 'SignUp'
    ) {
      onUnauthenticated();
    }
  });
  return new ApolloClient({
    link: ApolloLink.from([errors, reachability, http]),
    cache: new InMemoryCache({ typePolicies: TYPE_POLICIES }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-first', notifyOnNetworkStatusChange: false },
    },
  });
}
