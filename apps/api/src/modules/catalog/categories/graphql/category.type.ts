import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { Connection } from '../../../../common/pagination/connection.factory';

/** Category fields shared by `Category` and the event `CategorySnapshot`. */
@ObjectType({ isAbstract: true })
export abstract class CategoryFields {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  iconEmoji!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int)
  version!: number;
}

/** A category (F-12) with its active product count (one grouped query per page). */
@ObjectType('Category')
export class Category extends CategoryFields {
  @Field(() => Int)
  productCount!: number;
}

@ObjectType('CategoryConnection')
export class CategoryConnection extends Connection(Category) {}

@ObjectType('CategorySnapshot')
export class CategorySnapshot extends CategoryFields {}
