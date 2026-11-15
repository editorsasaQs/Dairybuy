import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasExpectedAuthUser } from '@/lib/supabase/verify-session';

function safePath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/account';
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !await hasExpectedAuthUser(supabase.auth, data.user?.id)) {
    return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
  }

  // NextRequest.url can be normalized to localhost by the local Next server even
  // when the incoming Host is 127.0.0.1. Use the configured canonical site origin
  // so the redirect stays on the same host that received the PKCE verifier cookie.
  const redirectOrigin = process.env['NEXT_PUBLIC_SITE_URL'] || request.nextUrl.origin;
  return NextResponse.redirect(new URL(safePath(request.nextUrl.searchParams.get('next')), redirectOrigin));
}
