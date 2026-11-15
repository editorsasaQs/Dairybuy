import { NextResponse } from 'next/server';
import type { ClientCartItemInput } from '@/lib/services/cart-service';
import { validateAndCalculateDatabaseCart, formatDatabaseCartResult } from '@/lib/services/database-cart-service';
import { createSupabaseServerClient, isServerSupabaseConfigured } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Cart validation is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items)) {
      return NextResponse.json(
        { success: false, error: 'Invalid cart payload provided.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const supabase = await createSupabaseServerClient();
    const result = await validateAndCalculateDatabaseCart(
      supabase,
      body.items as ClientCartItemInput[],
    );

    return NextResponse.json({
      success: result.isValid,
      data: formatDatabaseCartResult(result),
    }, {
      status: result.isValid ? 200 : 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/cart/validate] Database cart validation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to validate cart right now.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
