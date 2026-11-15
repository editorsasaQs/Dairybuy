import { NextResponse } from 'next/server';
import type { ClientCartItemInput } from '@/lib/services/cart-service';
import {
  clearAuthenticatedCart,
  loadAuthenticatedCart,
  replaceAuthenticatedCart,
} from '@/lib/services/persisted-cart-service';
import { parseMilkProductId } from '@/lib/bag';
import { createSupabaseServerClient, isServerSupabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCartItems(value: unknown): ClientCartItemInput[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const parsed: ClientCartItemInput[] = [];

  for (const [index, raw] of value.entries()) {
    if (!isRecord(raw) ||
        typeof raw["productVariantId"] !== 'string' ||
        !raw["productVariantId"].trim() ||
        !Number.isInteger(raw["quantity"]) ||
        (raw["quantity"] as number) < 1 ||
        (raw["quantity"] as number) > 100) {
      return null;
    }

    const key = typeof raw["key"] === 'string' && raw["key"].trim()
      ? raw["key"]
      : `line-${index + 1}`;

    if (raw["kind"] === 'milk') {
      if (typeof raw["productId"] !== 'string' ||
          typeof raw["litres"] !== 'number' ||
          !Number.isFinite(raw["litres"])) return null;
      const selection = parseMilkProductId(raw["productId"]);
      if (!selection || raw["milkType"] !== selection.type) return null;
      parsed.push({
        key,
        productVariantId: raw["productVariantId"],
        vendorId: selection.vendorId,
        milkType: selection.type,
        litres: raw["litres"],
        quantity: raw["quantity"] as number,
      });
      continue;
    }

    if (raw["kind"] !== 'catalogue' ||
        raw["vendorId"] != null ||
        raw["milkType"] != null ||
        raw["litres"] != null ||
        raw["vendorName"] != null) return null;

    parsed.push({
      key,
      productVariantId: raw["productVariantId"],
      quantity: raw["quantity"] as number,
    });
  }

  return parsed;
}

function unavailable() {
  return NextResponse.json(
    { success: false, error: 'Cart service is temporarily unavailable.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function authenticatedClient() {
  if (!isServerSupabaseConfigured()) return { response: unavailable() } as const;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Please sign in to access your saved cart.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    } as const;
  }
  return { supabase, user } as const;
}

export async function GET() {
  try {
    const auth = await authenticatedClient();
    if ('response' in auth) return auth.response;
    const snapshot = await loadAuthenticatedCart(auth.supabase, auth.user.id);
    return NextResponse.json({ success: true, data: snapshot }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/cart] Load failed:', error);
    return unavailable();
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticatedClient();
    if ('response' in auth) return auth.response;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON cart payload.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!isRecord(body) || !Array.isArray(body["items"])) {
      return NextResponse.json(
        { success: false, error: 'Invalid cart payload.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const items = parseCartItems(body["items"]);
    if (!items) {
      return NextResponse.json(
        { success: false, error: 'One or more cart items are malformed.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (items.length === 0) {
      await clearAuthenticatedCart(auth.supabase);
      return NextResponse.json({ success: true, data: { cartId: null, items: [] } }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const result = await replaceAuthenticatedCart(auth.supabase, items);
    if (!result.validation.isValid) {
      return NextResponse.json({
        success: false,
        data: result.validation,
      }, {
        status: 422,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        cartId: result.cartId,
        itemCount: result.validation.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotalPaise: result.validation.subtotalPaise,
        deliveryFeePaise: result.validation.deliveryFeePaise,
        totalPaise: result.validation.totalPaise,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/cart] Save failed:', error);
    return unavailable();
  }
}

export async function DELETE() {
  try {
    const auth = await authenticatedClient();
    if ('response' in auth) return auth.response;
    await clearAuthenticatedCart(auth.supabase);
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/cart] Clear failed:', error);
    return unavailable();
  }
}
