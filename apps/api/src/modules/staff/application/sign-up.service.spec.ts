import { randomBytes } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { SignUpService } from './sign-up.service';

import type { CreateStaffUserService } from './create-staff-user.service';
import type { RequestContext } from '../../../common/http/request-context';
import type { AppConfig } from '../../../config/app-config';
import type { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';

const secret = randomBytes(32).toString('hex');
const input = {
  username: 'sample1',
  fullName: 'Example',
  password: randomBytes(24).toString('base64url'),
  role: 'ADMIN' as const,
  signupSecret: secret,
};

function setup(configured: string | null = secret) {
  const consume = vi.fn().mockResolvedValue(undefined);
  const execute = vi.fn().mockResolvedValue(undefined);
  const service = new SignUpService(
    { SIGNUP_SECRET: configured ?? undefined } as AppConfig,
    { consume } as unknown as RateLimiterService,
    { client: () => ({ ip: '127.0.0.1' }) } as unknown as RequestContext,
    { execute } as unknown as CreateStaffUserService,
  );
  return { service, consume, execute };
}

describe('SignUpService', () => {
  it('limits before checking the secret and creates a normalized account without passing the secret', async () => {
    const { service, consume, execute } = setup();
    await service.execute({ ...input, username: ' SAMPLE1 ' });
    expect(consume.mock.calls).toEqual([
      ['signup-global', 'all'],
      ['signup-ip', '127.0.0.1'],
    ]);
    expect(execute).toHaveBeenCalledWith(
      { username: 'sample1', fullName: 'Example', password: input.password, role: 'ADMIN' },
      null,
    );
  });

  it('rejects wrong or disabled secrets before validating or creating', async () => {
    for (const configured of ['', randomBytes(32).toString('hex')]) {
      const { service, execute } = setup(configured);
      await expect(service.execute(input)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('rejects an absent configured secret', async () => {
    const { service, execute } = setup(null);
    await expect(service.execute({ ...input, signupSecret: '' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('validates fields after authentication', async () => {
    const { service, execute } = setup();
    await expect(service.execute({ ...input, password: 'short' })).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not create an account when the limiter refuses', async () => {
    const { service, consume, execute } = setup();
    consume.mockRejectedValueOnce(new Error('unavailable'));
    await expect(service.execute(input)).rejects.toThrow('unavailable');
    expect(execute).not.toHaveBeenCalled();
  });
});
