import { describe, expect, it } from 'vitest';
import { createAdminSessionCookie, verifyAdminToken } from '../auth';

describe('admin auth', () => {
  it('accepts the configured admin token and emits a secure session cookie', async () => {
    expect(await verifyAdminToken('super-secret', 'super-secret')).toBe(true);
    expect(createAdminSessionCookie('signed-token')).toContain('openclaw_admin_session=');
  });
});
