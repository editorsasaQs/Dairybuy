import { describe, expect, it, vi } from 'vitest';
import { hasExpectedAuthUser } from './verify-session';

describe('hasExpectedAuthUser', () => {
  it('accepts the same user persisted in the cookie session', async () => {
    const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'customer-b' } }, error: null }) };
    await expect(hasExpectedAuthUser(auth as never, 'customer-b')).resolves.toBe(true);
    expect(auth.getUser).toHaveBeenCalledOnce();
  });

  it('rejects a stale session belonging to a different customer', async () => {
    const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'customer-a' } }, error: null }) };
    await expect(hasExpectedAuthUser(auth as never, 'customer-b')).resolves.toBe(false);
  });

  it('rejects missing identities and session lookup errors', async () => {
    const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('session unavailable') }) };
    await expect(hasExpectedAuthUser(auth as never, 'customer-b')).resolves.toBe(false);
    await expect(hasExpectedAuthUser(auth as never, null)).resolves.toBe(false);
    expect(auth.getUser).toHaveBeenCalledOnce();
  });
});
