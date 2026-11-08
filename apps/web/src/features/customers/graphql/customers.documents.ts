import { graphql } from '@/graphql/__generated__';

/** Customer khata operations (API.md §6, F-25). Entry mutations return the customer's new balance. */
export const CustomersDocument = graphql(`
  query Customers($after: String, $filter: PartyFilter) {
    customers(after: $after, filter: $filter) {
      nodes {
        ...CustomerFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

export const CustomerDocument = graphql(`
  query Customer($id: ID!) {
    customer(id: $id) {
      ...CustomerFields
    }
  }
`);

export const CustomerKpisDocument = graphql(`
  query CustomerKpis {
    dashboard {
      customerCount
      customerDues
    }
  }
`);

export const CustomerLedgerDocument = graphql(`
  query CustomerLedger($customerId: ID!, $after: String, $includeArchived: Boolean) {
    customerLedger(customerId: $customerId, after: $after, includeArchived: $includeArchived) {
      nodes {
        id
        type
        amount
        balanceAfter
        paymentMethod
        note
        orderId
        billNumber
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

export const CreateCustomerDocument = graphql(`
  mutation CreateCustomer($input: CreateCustomerInput!) {
    createCustomer(input: $input) {
      ...CustomerFields
    }
  }
`);

export const UpdateCustomerDocument = graphql(`
  mutation UpdateCustomer($input: UpdateCustomerInput!) {
    updateCustomer(input: $input) {
      ...CustomerFields
    }
  }
`);

export const AddCustomerCreditDocument = graphql(`
  mutation AddCustomerCredit($input: AddCustomerCreditInput!) {
    addCustomerCredit(input: $input) {
      ...CustomerFields
    }
  }
`);

export const ReceiveCustomerPaymentDocument = graphql(`
  mutation ReceiveCustomerPayment($input: ReceiveCustomerPaymentInput!) {
    receiveCustomerPayment(input: $input) {
      ...CustomerFields
    }
  }
`);

export const ArchiveCustomerDocument = graphql(`
  mutation ArchiveCustomer($id: ID!) {
    archiveCustomer(id: $id) {
      ...CustomerFields
    }
  }
`);

export const RestoreCustomerDocument = graphql(`
  mutation RestoreCustomer($id: ID!) {
    restoreCustomer(id: $id) {
      ...CustomerFields
    }
  }
`);

export const DeleteCustomerDocument = graphql(`
  mutation DeleteCustomer($id: ID!) {
    deleteCustomer(id: $id)
  }
`);
