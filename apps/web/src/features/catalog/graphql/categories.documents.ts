import { graphql } from '@/graphql/__generated__';

/** Category operations (API.md §6, F-12). */
export const CategoriesDocument = graphql(`
  query Categories($after: String, $filter: CategoriesFilter) {
    categories(after: $after, filter: $filter) {
      nodes {
        ...CategoryFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

/**
 * Category choices for filters and the product form: the first page of 50, which the API serves
 * from its reference cache. The shop has about 22 categories (FEATURES.md §3.4).
 */
export const CategoryOptionsDocument = graphql(`
  query CategoryOptions {
    categories(first: 50) {
      nodes {
        id
        name
        iconEmoji
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`);

export const CreateCategoryDocument = graphql(`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      ...CategoryFields
    }
  }
`);

export const UpdateCategoryDocument = graphql(`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      ...CategoryFields
    }
  }
`);

export const DeleteCategoryDocument = graphql(`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`);
