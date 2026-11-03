import { USER_ROLES } from '@pos/contracts';

import { ROLE_LABEL } from '../staff-user';

/** Role choices for staff forms, labelled for people. */
export const ROLE_OPTIONS = USER_ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));
