import { graphql } from '@/graphql/__generated__';

/** Staff operations (API.md §6, F-31). Every mutation returns the same small fragment. */
export const StaffUserFieldsFragment = graphql(`
  fragment StaffUserFields on StaffUser {
    id
    username
    fullName
    role
    status
    version
  }
`);

export const StaffUsersDocument = graphql(`
  query StaffUsers($after: String, $filter: StaffUsersFilter) {
    staffUsers(after: $after, filter: $filter) {
      nodes {
        ...StaffUserFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

export const CreateStaffUserDocument = graphql(`
  mutation CreateStaffUser($input: CreateStaffUserInput!) {
    createStaffUser(input: $input) {
      ...StaffUserFields
    }
  }
`);

export const UpdateStaffUserDocument = graphql(`
  mutation UpdateStaffUser($input: UpdateStaffUserInput!) {
    updateStaffUser(input: $input) {
      ...StaffUserFields
    }
  }
`);

export const SetStaffUserStatusDocument = graphql(`
  mutation SetStaffUserStatus($input: SetStaffUserStatusInput!) {
    setStaffUserStatus(input: $input) {
      ...StaffUserFields
    }
  }
`);

export const ResetStaffPasswordDocument = graphql(`
  mutation ResetStaffPassword($input: ResetStaffPasswordInput!) {
    resetStaffPassword(input: $input) {
      ...StaffUserFields
    }
  }
`);

export const DeleteStaffUserDocument = graphql(`
  mutation DeleteStaffUser($id: ID!) {
    deleteStaffUser(id: $id)
  }
`);
