import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { toast } from 'sonner';

import { formatRs } from '@pos/domain';

import { errorCodeOf, userMessageOf } from '@/lib/errors/graphql-error';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function extension(error: unknown, name: string): unknown {
  return CombinedGraphQLErrors.is(error) ? error.errors[0]?.extensions?.[name] : undefined;
}

/**
 * Tells the cashier why the server refused a sale (nothing was recorded) and repairs what it can:
 * new prices are re-read so the preview shows the server's total (PRICE_CHANGED), and products no
 * longer for sale are taken out of the cart (NOT_FOUND with their ids).
 */
export function explainSaleError(
  error: unknown,
  repair: { refreshPrices: () => void; removeProducts: (productIds: string[]) => void },
): void {
  const code = errorCodeOf(error);
  if (code === 'PRICE_CHANGED') {
    const quote = extension(error, 'quote');
    const total = isRecord(quote) && typeof quote['total'] === 'string' ? quote['total'] : null;
    repair.refreshPrices();
    toast.error(
      total === null
        ? 'Prices changed. Check the cart and take payment again.'
        : `Prices changed: the total is now ${formatRs(total)}. Check the cart and take payment again.`,
    );
    return;
  }
  const productIds = extension(error, 'productIds');
  if (code === 'NOT_FOUND' && Array.isArray(productIds)) {
    repair.removeProducts(productIds.filter((id): id is string => typeof id === 'string'));
    toast.error('Some items are no longer for sale and were removed from the cart.');
    return;
  }
  toast.error(userMessageOf(error));
}
