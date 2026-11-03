import { CombinedGraphQLErrors } from '@apollo/client/errors';

import { OrderReceiptDocument } from '@/features/orders';
import { retryDelay } from '@/lib/realtime/backoff';
import { sleep } from '@/lib/timing/sleep';

import { CreateSaleDocument, SaleStatusDocument } from '../graphql/sale.documents';

import type { CreateSaleInput, ReceiptFieldsFragment } from '@/graphql/__generated__/graphql';
import type { ApolloClient } from '@apollo/client';

/** Re-sends of one sale after network failures: about 1, 2, 4, 8, 16 s apart (§3.4). */
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

export interface CompletedSale {
  receipt: ReceiptFieldsFragment;
  stockWarnings: readonly { productId: string; productName: string; stockAfter: number }[];
  /** False for a sale confirmed later by `saleStatus`: the cashier chooses to print. */
  autoPrint: boolean;
}

export type SendOutcome =
  | { kind: 'done'; sale: CompletedSale }
  | { kind: 'refused'; error: CombinedGraphQLErrors }
  | { kind: 'unknown' };

/** Resolves at once when the browser has a network, otherwise on its `online` event. */
function whenOnline(): Promise<void> {
  return navigator.onLine
    ? Promise.resolve()
    : new Promise((resolve) => {
        window.addEventListener(
          'online',
          () => {
            resolve();
          },
          { once: true },
        );
      });
}

/**
 * Sends one sale, re-sending the same input and key after network failures or a 30 s timeout
 * (event-triggered retries of one mutation, not polling). The server replays a key it has seen, so
 * re-sending never makes a second bill. A GraphQL error means the server refused: nothing recorded.
 */
export async function sendSale(
  client: ApolloClient,
  input: CreateSaleInput,
  onRetrying: () => void,
): Promise<SendOutcome> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const { data } = await client.mutate({
        mutation: CreateSaleDocument,
        variables: { input },
        context: { fetchOptions: { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) } },
      });
      if (data == null) {
        return { kind: 'unknown' };
      }
      const { receipt, stockWarnings } = data.createSale;
      return { kind: 'done', sale: { receipt, stockWarnings, autoPrint: true } };
    } catch (error) {
      if (CombinedGraphQLErrors.is(error)) {
        return { kind: 'refused', error };
      }
      onRetrying();
      await sleep(retryDelay(attempt));
      await whenOnline();
    }
  }
  return { kind: 'unknown' };
}

/** "Check status" (§3.4): the confirmed sale with its receipt, or null when it was not recorded. */
export async function confirmSale(
  client: ApolloClient,
  idempotencyKey: CreateSaleInput['idempotencyKey'],
): Promise<CompletedSale | null> {
  const { data } = await client.query({
    query: SaleStatusDocument,
    variables: { idempotencyKey },
    fetchPolicy: 'network-only',
  });
  const order = data?.saleStatus;
  if (order == null) {
    return null;
  }
  const receipt = await client.query({
    query: OrderReceiptDocument,
    variables: { orderId: order.id },
    fetchPolicy: 'network-only',
  });
  if (receipt.data === undefined) {
    throw new Error('The receipt could not be loaded.');
  }
  return { receipt: receipt.data.orderReceipt, stockWarnings: [], autoPrint: false };
}
