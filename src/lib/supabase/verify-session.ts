import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type AuthApi = Pick<SupabaseClient<Database>['auth'], 'getUser'>;

/**
 * Confirms the identity persisted in the request cookies matches the identity
 * returned by the credential/code exchange. Never trusts the exchange alone.
 */
export async function hasExpectedAuthUser(
  auth: AuthApi,
  expectedUserId: string | null | undefined,
): Promise<boolean> {
  if (!expectedUserId) return false;
  const { data, error } = await auth.getUser();
  return !error && data.user?.id === expectedUserId;
}
