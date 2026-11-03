import { Injectable } from '@nestjs/common';

import { ROLE_PERMISSIONS } from '@pos/contracts';

import { AppError } from '../../../common/errors/app-error';
import { AuthUsersRepository } from '../persistence/auth-users.repository';

import type { Viewer } from '../graphql/viewer.type';

/** Loads the `Viewer` for `me` and `login` (one small select; permissions come from the role). */
@Injectable()
export class ViewerService {
  constructor(private readonly users: AuthUsersRepository) {}

  async load(userId: string): Promise<Viewer> {
    const row = await this.users.findViewer(userId);
    if (row === null) {
      throw new AppError('UNAUTHENTICATED', 'Please sign in again.');
    }
    return { ...row, permissions: [...ROLE_PERMISSIONS[row.role]] };
  }
}
