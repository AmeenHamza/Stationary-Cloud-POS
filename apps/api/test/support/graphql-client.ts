export interface GraphqlResponse<T = Record<string, unknown>> {
  status: number;
  body: {
    data?: T | null;
    errors?: { message: string; extensions?: Record<string, unknown> }[];
  };
}

/** POSTs an operation the way the web app does (JSON, so Apollo's CSRF check passes). */
export async function postGraphql<T = Record<string, unknown>>(
  baseUrl: string,
  query: string,
  options: { variables?: Record<string, unknown>; headers?: Record<string, string> } = {},
): Promise<GraphqlResponse<T>> {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...options.headers },
    body: JSON.stringify({ query, variables: options.variables ?? {} }),
  });
  return { status: response.status, body: (await response.json()) as GraphqlResponse<T>['body'] };
}

/** First error code of a response, for compact assertions. */
export function errorCode(response: GraphqlResponse<unknown>): unknown {
  return response.body.errors?.[0]?.extensions?.['code'];
}

/** The data of a response, or a thrown error with the GraphQL errors (clear test failures). */
export function dataOf<T>(response: GraphqlResponse<T>): T {
  if (response.body.data == null) {
    throw new Error(`GraphQL failed: ${JSON.stringify(response.body.errors)}`);
  }
  return response.body.data;
}
