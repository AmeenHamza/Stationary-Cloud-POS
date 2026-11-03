import { describe, expect, it } from 'vitest';

import { signUpInputSchema } from './index.js';

const randomValue = (): string =>
  `fixture-${Math.random().toString(36)}-${Math.random().toString(36)}`;
const secret = randomValue();
const valid = {
  fullName: 'Example',
  username: 'sample1',
  password: randomValue(),
  role: 'ADMIN',
  signupSecret: secret,
};

describe('signUpInputSchema', () => {
  it('shares staff normalization and accepts both roles', () => {
    for (const role of ['ADMIN', 'CASHIER']) {
      expect(
        signUpInputSchema.parse({ ...valid, role, username: ' SAMPLE1 ', fullName: ' Example ' }),
      ).toMatchObject({ username: 'sample1', fullName: 'Example', role, signupSecret: secret });
    }
  });

  it('rejects missing or oversized secrets and invalid staff fields', () => {
    for (const changes of [
      { signupSecret: '' },
      { signupSecret: undefined },
      { signupSecret: 'x'.repeat(1025) },
      { username: 'a' },
      { fullName: ' ' },
      { password: 'short' },
      { password: 'SAMPLE1' },
      { role: 'OWNER' },
    ]) {
      expect(signUpInputSchema.safeParse({ ...valid, ...changes }).success).toBe(false);
    }
  });
});
