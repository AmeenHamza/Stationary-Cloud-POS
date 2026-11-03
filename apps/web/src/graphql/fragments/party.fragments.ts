import { graphql } from '@/graphql/__generated__';

/** Customer and vendor rows (khata lists and headers). */
export const CustomerFieldsFragment = graphql(`
  fragment CustomerFields on Customer {
    id
    name
    phone
    email
    address
    balance
    archivedAt
    version
  }
`);

export const VendorFieldsFragment = graphql(`
  fragment VendorFields on Vendor {
    id
    name
    phone
    email
    address
    productsSupplied
    balance
    archivedAt
    version
  }
`);

/** The fields a `*.balanceChanged` event patches. */
export const CustomerBalanceFragment = graphql(`
  fragment CustomerBalance on Customer {
    id
    balance
    version
  }
`);

export const VendorBalanceFragment = graphql(`
  fragment VendorBalance on Vendor {
    id
    balance
    version
  }
`);
