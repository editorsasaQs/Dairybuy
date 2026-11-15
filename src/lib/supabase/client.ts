import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || '';
const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || '';

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co'
  );
}

/**
 * Returns the singleton browser Supabase client.
 * Returns null if Supabase environment variables are not yet configured,
 * triggering safe fallback to local authoritative dataset.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return browserClient;
}
