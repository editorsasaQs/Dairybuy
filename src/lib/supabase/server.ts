import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export function isServerSupabaseConfigured(): boolean {
  return Boolean(
    (process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['SUPABASE_URL']) &&
    (process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  );
}

function config() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Supabase URL and publishable/anon key are required.');
  return { url, key };
}

export async function createSupabaseServerClient() {
  const { url, key } = config();
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes them.
        }
      },
    },
  });
}
