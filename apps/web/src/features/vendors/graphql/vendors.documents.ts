import { graphql } from '@/graphql/__generated__';

/** Supplier khata operations (API.md §6, F-26). Entry mutations return the vendor's new balance. */
export const VendorsDocument = graphql(`
  query Vendors($after: String, $filter: PartyFilter) {
    vendors(after: $after, filter: $filter) {
      nodes {
        ...VendorFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

export const VendorDocument = graphql(`
  query Vendor($id: ID!) {
    vendor(id: $id) {
      ...VendorFields
    }
  }
`);

export const VendorKpisDocument = graphql(`
  query VendorKpis {
    dashboard {
      vendorCount
      vendorOwes
    }
  }
`);

export const VendorLedgerDocument = graphql(`
  query VendorLedger($vendorId: ID!, $after: String, $includeArchived: Boolean) {
    vendorLedger(vendorId: $vendorId, after: $after, includeArchived: $includeArchived) {
      nodes {
        id
        type
        amount
        balanceAfter
        paymentMethod
        note
        businessDate
        createdAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

export const CreateVendorDocument = graphql(`
  mutation CreateVendor($input: CreateVendorInput!) {
    createVendor(input: $input) {
      ...VendorFields
    }
  }
`);

export const UpdateVendorDocument = graphql(`
  mutation UpdateVendor($input: UpdateVendorInput!) {
    updateVendor(input: $input) {
      ...VendorFields
    }
  }
`);

export const AddVendorPurchaseDocument = graphql(`
  mutation AddVendorPurchase($input: AddVendorPurchaseInput!) {
    addVendorPurchase(input: $input) {
      ...VendorFields
    }
  }
`);

export const PayVendorDocument = graphql(`
  mutation PayVendor($input: PayVendorInput!) {
    payVendor(input: $input) {
      ...VendorFields
    }
  }
`);

export const ArchiveVendorDocument = graphql(`
  mutation ArchiveVendor($id: ID!) {
    archiveVendor(id: $id) {
      ...VendorFields
    }
  }
`);

export const RestoreVendorDocument = graphql(`
  mutation RestoreVendor($id: ID!) {
    restoreVendor(id: $id) {
      ...VendorFields
    }
  }
`);

export const DeleteVendorDocument = graphql(`
  mutation DeleteVendor($id: ID!) {
    deleteVendor(id: $id)
  }
`);
