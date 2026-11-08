import { graphql } from '@/graphql/__generated__';

/** Product operations (API.md §6, F-08, F-09). Lists select the shared fragment only, no cost price. */
export const ProductsDocument = graphql(`
  query Products($after: String, $filter: ProductFilter, $sort: ProductSort) {
    products(after: $after, filter: $filter, sort: $sort) {
      nodes {
        ...ProductFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

/** The edit form also needs the cost price, which only admins may read (SEC-03). */
export const ProductForEditDocument = graphql(`
  query ProductForEdit($id: ID!) {
    product(id: $id) {
      ...ProductFields
      costPrice
    }
  }
`);

export const ProductInventoryKpisDocument = graphql(`
  query ProductInventoryKpis {
    dashboard {
      inventory {
        costValue
        sellingValue
      }
    }
  }
`);

export const CreateProductDocument = graphql(`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      ...ProductFields
    }
  }
`);

export const UpdateProductDocument = graphql(`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      ...ProductFields
      costPrice
    }
  }
`);

export const CloneProductDocument = graphql(`
  mutation CloneProduct($input: CloneProductInput!) {
    cloneProduct(input: $input) {
      ...ProductFields
    }
  }
`);

export const ArchiveProductDocument = graphql(`
  mutation ArchiveProduct($id: ID!) {
    archiveProduct(id: $id) {
      ...ProductFields
    }
  }
`);

export const RestoreProductDocument = graphql(`
  mutation RestoreProduct($id: ID!) {
    restoreProduct(id: $id) {
      ...ProductFields
    }
  }
`);

export const DeleteProductDocument = graphql(`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id)
  }
`);
