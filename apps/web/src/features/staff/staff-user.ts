import type { UserRole, UserStatus } from '@pos/contracts';

/** A row of the Staff screen (the `StaffUserFields` fragment). */
export interface StaffMember {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  version: number;
}

export const ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  ADMIN: 'Admin',
  CASHIER: 'Cashier',
};
