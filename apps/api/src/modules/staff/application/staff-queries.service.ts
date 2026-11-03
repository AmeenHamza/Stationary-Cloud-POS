import { Injectable } from '@nestjs/common';

import { toConnection } from '../../../common/pagination/keyset';
import { STAFF_SORT, StaffRepository, type StaffRow } from '../persistence/staff.repository';

import type { ConnectionValue } from '../../../common/pagination/connection.factory';
import type { StaffUsersArgs } from '@pos/validation';

/** `staffUsers` (API.md §6.1): name-ordered keyset pages; the total is counted only if selected. */
@Injectable()
export class StaffQueriesService {
  constructor(private readonly staff: StaffRepository) {}

  async list(args: StaffUsersArgs): Promise<ConnectionValue<StaffRow>> {
    const filter = args.filter ?? {};
    const rows = await this.staff.list(filter, args.first + 1, args.after);
    return toConnection(
      rows,
      args.first,
      STAFF_SORT,
      (row) => row.fullName,
      () => this.staff.count(filter),
    );
  }
}
