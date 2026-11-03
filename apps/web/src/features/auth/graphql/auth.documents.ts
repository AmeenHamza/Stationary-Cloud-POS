import { graphql } from '@/graphql/__generated__';

/** Auth operations (API.md §6). Small selections: the viewer is the only object fetched. */
export const MeDocument = graphql(`
  query Me {
    me {
      id
      username
      fullName
      role
      permissions
    }
  }
`);

export const LoginDocument = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      id
      username
      fullName
      role
      permissions
    }
  }
`);

export const SignUpDocument = graphql(`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input)
  }
`);

export const LogoutDocument = graphql(`
  mutation Logout {
    logout
  }
`);

export const ChangePasswordDocument = graphql(`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`);
