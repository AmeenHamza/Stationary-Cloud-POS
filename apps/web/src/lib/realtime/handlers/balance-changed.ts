import {
  CustomerBalanceFragment,
  VendorBalanceFragment,
} from '@/graphql/fragments/party.fragments';

import { entityId, isNewer } from './versions';

import type { EventOf } from '../event-types';
import type {
  CustomerBalanceFragment as CustomerBalance,
  VendorBalanceFragment as VendorBalance,
} from '@/graphql/__generated__/graphql';
import type { ApolloCache } from '@apollo/client';

/**
 * `customer.balanceChanged` / `vendor.balanceChanged`: patch the cached party's balance when the
 * event is newer (lists and khata headers update in place; nothing is fetched for unseen parties).
 */
export function applyBalanceChanged(
  cache: ApolloCache,
  event: EventOf<'CustomerBalanceChangedEvent'> | EventOf<'VendorBalanceChangedEvent'>,
): void {
  const { balance, version } = event;
  if (event.__typename === 'CustomerBalanceChangedEvent') {
    const id = event.customerId;
    if (isNewer(cache, 'Customer', id, version)) {
      const data: CustomerBalance & { __typename: 'Customer' } = {
        __typename: 'Customer',
        id,
        balance,
        version,
      };
      cache.writeFragment({
        id: entityId(cache, 'Customer', id),
        fragment: CustomerBalanceFragment,
        data,
      });
    }
    return;
  }
  const id = event.vendorId;
  if (isNewer(cache, 'Vendor', id, version)) {
    const data: VendorBalance & { __typename: 'Vendor' } = {
      __typename: 'Vendor',
      id,
      balance,
      version,
    };
    cache.writeFragment({
      id: entityId(cache, 'Vendor', id),
      fragment: VendorBalanceFragment,
      data,
    });
  }
}
