import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { BusinessDate } from '@pos/domain';

/**
 * Daily bill numbers (BR-05, DATABASE.md §4.9). The business date comes from the database clock in
 * Asia/Karachi, so bills around midnight and instances with skewed clocks still number correctly;
 * the upsert's row lock makes concurrent bills take consecutive numbers (FIN-11).
 */
@Injectable()
export class BillCounterRepository {
  constructor(private readonly db: TransactionalClient) {}

  async next(): Promise<{ businessDate: BusinessDate; sequence: number }> {
    const rows = await this.db.client.$queryRaw<{ businessDate: string; sequence: number }[]>`
      INSERT INTO bill_number_counters (business_date, last_value)
      VALUES ((now() AT TIME ZONE 'Asia/Karachi')::date, 1)
      ON CONFLICT (business_date) DO UPDATE SET last_value = bill_number_counters.last_value + 1
      RETURNING to_char(business_date, 'YYYY-MM-DD') AS "businessDate", last_value AS "sequence"`;
    const row = rows[0];
    if (row === undefined) {
      throw new Error('bill counter upsert returned no row');
    }
    return { businessDate: row.businessDate, sequence: row.sequence };
  }
}
