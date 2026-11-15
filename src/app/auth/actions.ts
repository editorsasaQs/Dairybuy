'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasExpectedAuthUser } from '@/lib/supabase/verify-session';

export type AuthState = { error?: string; message?: string };
const genericError = 'Details check karein aur dobara try karein.';

export async function signInAction(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (!email || !password) return { error: 'Email aur password required hain.' };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: /invalid login credentials/i.test(error.message) ? 'Email ya password galat hai.' : genericError };
    if (!await hasExpectedAuthUser(supabase.auth, data.user?.id)) return { error: genericError };
  } catch { return { error: 'Supabase environment variables configured nahi hain.' }; }
  redirect('/account');
}

export async function signUpAction(_state: AuthState, form: FormData): Promise<AuthState> {
  const fullName = String(form.get('full_name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (!fullName || !email || !password) return { error: 'Saare fields fill karein.' };
  if (fullName.length > 100 || password.length < 8) return { error: 'Name 100 characters tak aur password minimum 8 characters ka rakhein.' };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: new URL('/auth/callback?next=/account', process.env['NEXT_PUBLIC_SITE_URL'] || 'http://localhost:3000').toString(),
      },
    });
    if (error) return { error: /already registered/i.test(error.message) ? 'Ye email pehle se registered hai. Login karein.' : genericError };
    if (!data.session) return { message: 'Account create ho gaya. Inbox mein email confirmation link check karein, phir login karein.' };
    if (!await hasExpectedAuthUser(supabase.auth, data.user?.id)) return { error: genericError };
  } catch { return { error: 'Supabase environment variables configured nahi hain.' }; }
  redirect('/account');
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
