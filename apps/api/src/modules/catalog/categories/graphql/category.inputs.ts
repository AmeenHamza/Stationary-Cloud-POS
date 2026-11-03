import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';

import { PageArgs } from '../../../../common/pagination/page.args';

/** Shapes only; validation is in `@pos/validation` (category.schemas.ts). */
@InputType()
export class CategoriesFilter {
  @Field(() => String, { nullable: true })
  search?: string | null;
}

@ArgsType()
export class CategoriesArgs extends PageArgs {
  @Field(() => CategoriesFilter, { nullable: true })
  filter?: CategoriesFilter | null;
}

@InputType()
export class CreateCategoryInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  iconEmoji?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}

@InputType()
export class UpdateCategoryInput extends CreateCategoryInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  version!: number;
}
