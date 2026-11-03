import { Decimal } from '@pos/domain';

import { moneyText } from '../../../common/graphql/scalars';

import type { AmountRow } from '../persistence/sales-metrics.repository';

/** Sales minus refunds as two-decimal text. */
export const netOf = (row: Pick<AmountRow, 'sales' | 'refunds'> | undefined): string =>
  row === undefined ? '0.00' : moneyText(new Decimal(row.sales).minus(row.refunds));

export const byKey = (rows: readonly AmountRow[]) => new Map(rows.map((row) => [row.key, row]));

/** Money text, or null when the column was null (e.g. a product without a cost price). */
export const moneyOrNull = (value: string | null): string | null =>
  value === null ? null : moneyText(value);
