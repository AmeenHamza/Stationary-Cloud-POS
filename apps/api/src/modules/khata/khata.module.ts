import { Module } from '@nestjs/common';

import { AuditModule } from '../audit';

import { CustomersService } from './customers/application/customers.service';
import { CustomerKhataResolver } from './customers/graphql/customer-khata.resolver';
import { CustomersResolver } from './customers/graphql/customers.resolver';
import { CustomersRepository } from './customers/persistence/customers.repository';
import { LedgerPosting } from './ledger/ledger-posting.service';
import { PartyCommands } from './ledger/party-commands.service';
import { PartyQueries } from './ledger/party-queries.service';
import { VendorsService } from './vendors/application/vendors.service';
import { VendorKhataResolver } from './vendors/graphql/vendor-khata.resolver';
import { VendorsResolver } from './vendors/graphql/vendors.resolver';
import { VendorsRepository } from './vendors/persistence/vendors.repository';

/**
 * Customer and vendor khata (F-25, F-26, D-11, D-12). One shared ledger engine (`ledger/`) serves
 * both party kinds; billing posts credit sales and refund credits through `CustomersService`.
 */
@Module({
  imports: [AuditModule],
  providers: [
    LedgerPosting,
    PartyCommands,
    PartyQueries,
    CustomersRepository,
    CustomersService,
    CustomersResolver,
    CustomerKhataResolver,
    VendorsRepository,
    VendorsService,
    VendorsResolver,
    VendorKhataResolver,
  ],
  exports: [CustomersService],
})
export class KhataModule {}
