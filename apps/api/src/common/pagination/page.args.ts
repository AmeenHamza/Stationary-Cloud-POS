import { ArgsType, Field, Int } from '@nestjs/graphql';

import { PAGE_SIZE_DEFAULT } from '@pos/contracts';

/**
 * Arguments of every connection field (API.md §3). Values are validated by
 * `ZodValidationPipe(pageArgsSchema)`: first ≤ 50, enforced here in the backend.
 */
@ArgsType()
export class PageArgs {
  @Field(() => Int, { defaultValue: PAGE_SIZE_DEFAULT })
  first: number = PAGE_SIZE_DEFAULT;

  @Field(() => String, { nullable: true })
  after?: string | null;
}
