import { randomUUID } from 'node:crypto';

import { dataOf } from './graphql-client';
import { asUser } from './staff';

export { dataOf };

export const PARTY_FIELDS = 'id name phone email address balance archivedAt version';

export const CUSTOMERS = `query Customers($first: Int, $after: String, $filter: PartyFilter) {
  customers(first: $first, after: $after, filter: $filter) {
    nodes { ${PARTY_FIELDS} } pageInfo { hasNextPage endCursor } totalCount
  }
}`;

export const CREATE_CUSTOMER = `mutation Create($input: CreateCustomerInput!) {
  createCustomer(input: $input) { ${PARTY_FIELDS} }
}`;

export const UPDATE_CUSTOMER = `mutation Update($input: UpdateCustomerInput!) {
  updateCustomer(input: $input) { ${PARTY_FIELDS} }
}`;

export const ADD_CREDIT = `mutation Credit($input: AddCustomerCreditInput!) {
  addCustomerCredit(input: $input) { ${PARTY_FIELDS} }
}`;

export const RECEIVE_PAYMENT = `mutation Pay($input: ReceiveCustomerPaymentInput!) {
  receiveCustomerPayment(input: $input) { ${PARTY_FIELDS} }
}`;

export const ARCHIVE_CUSTOMER = `mutation A($id: ID!) { archiveCustomer(id: $id) { ${PARTY_FIELDS} } }`;
export const RESTORE_CUSTOMER = `mutation R($id: ID!) { restoreCustomer(id: $id) { ${PARTY_FIELDS} } }`;

export const ENTRY_FIELDS = 'id type amount balanceAfter paymentMethod note businessDate';

export const CUSTOMER_LEDGER = `query Ledger($customerId: ID!, $first: Int, $after: String, $includeArchived: Boolean) {
  customerLedger(customerId: $customerId, first: $first, after: $after, includeArchived: $includeArchived) {
    nodes { ${ENTRY_FIELDS} orderId } pageInfo { hasNextPage endCursor } totalCount
  }
}`;

export const CREATE_VENDOR = `mutation Create($input: CreateVendorInput!) {
  createVendor(input: $input) { ${PARTY_FIELDS} productsSupplied }
}`;

export const ADD_PURCHASE = `mutation Buy($input: AddVendorPurchaseInput!) {
  addVendorPurchase(input: $input) { ${PARTY_FIELDS} }
}`;

export const PAY_VENDOR = `mutation Pay($input: PayVendorInput!) { payVendor(input: $input) { ${PARTY_FIELDS} } }`;

export const VENDOR_LEDGER = `query Ledger($vendorId: ID!) {
  vendorLedger(vendorId: $vendorId) { nodes { ${ENTRY_FIELDS} } totalCount }
}`;

export interface PartyNode {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
  archivedAt: string | null;
  version: number;
}

export interface EntryNode {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  paymentMethod: string | null;
  note: string | null;
}

export async function createCustomer(
  baseUrl: string,
  cookie: string,
  input: Record<string, unknown>,
): Promise<PartyNode> {
  const response = await asUser<{ createCustomer: PartyNode }>(baseUrl, cookie, CREATE_CUSTOMER, {
    input,
  });
  return dataOf(response).createCustomer;
}

/** A khata entry input with a fresh idempotency key; override any field. */
export function entryInput(fields: Record<string, unknown>): Record<string, unknown> {
  return { idempotencyKey: randomUUID(), ...fields };
}
