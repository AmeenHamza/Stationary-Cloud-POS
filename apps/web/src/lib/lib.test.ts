import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { describe, expect, it } from 'vitest';

import { errorCodeOf, fieldErrorsOf, userMessageOf } from './errors/graphql-error';
import { isThemeChoice, resolveTheme } from './theme/theme';

const graphqlError = (message: string, extensions: Record<string, unknown>) =>
  new CombinedGraphQLErrors({ errors: [{ message, extensions }] });

describe('GraphQL error helpers (API.md §4)', () => {
  it('reads the code, field errors and message of GraphQL errors', () => {
    const error = graphqlError('Some fields are invalid.', {
      code: 'BAD_USER_INPUT',
      fieldErrors: { username: 'This username is already taken', bogus: 42 },
    });
    expect(errorCodeOf(error)).toBe('BAD_USER_INPUT');
    expect(fieldErrorsOf(error)).toEqual({ username: 'This username is already taken' });
    expect(userMessageOf(error)).toBe('Some fields are invalid.');
  });

  it('treats network failures as having no code and shows a generic message', () => {
    const network = new TypeError('Failed to fetch');
    expect(errorCodeOf(network)).toBeNull();
    expect(fieldErrorsOf(network)).toEqual({});
    expect(userMessageOf(network)).toMatch(/Cannot reach the server/);
  });
});

describe('theme (F-05)', () => {
  it('resolves system to the OS preference and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('accepts only known stored values', () => {
    expect(['light', 'dark', 'system'].every(isThemeChoice)).toBe(true);
    expect([null, 'blue', 1].some(isThemeChoice)).toBe(false);
  });
});
