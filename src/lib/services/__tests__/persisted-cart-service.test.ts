import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  clearAuthenticatedCart,
  replaceAuthenticatedCart,
} from '../persisted-cart-service';

function mockSupabase(rows: Record<string, unknown[]>) {
  const rpc = vi.fn().mockResolvedValue({ data: 'cart-uuid', error: null });
  const client = {
    from(table: string) {
      const query = {
        select() { return this; },
        in() { return this; },
        eq() { return this; },
        is() { return this; },
        lte() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: rows[table]?.[0] ?? null, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc,
  };
  return { client: client as unknown as SupabaseClient<Database>, rpc };
}

describe('authenticated cart persistence service', () => {
  it('persists only database-validated prices through the atomic RPC', async () => {
    const { client, rpc } = mockSupabase({
      product_variants: [{
        id: 'ghee-red-cow-200ml',
        product_id: 'ghee-red-cow',
        variant_name: '200 ml',
        brand: 'Red Cow',
        unit_quantity: 0.2,
        final_price_paise: 17900,
        is_orderable: true,
      }],
      products: [{
        id: 'ghee-red-cow',
        name: 'Red Cow Pure Ghee',
        product_type: 'grocery_dairy',
        is_active: true,
      }],
      app_settings: [{ key: 'delivery_fee_paise', value: 400 }],
    });

    const result = await replaceAuthenticatedCart(client, [{
      key: 'catalogue:ghee-red-cow',
      productVariantId: 'ghee-red-cow-200ml',
      quantity: 2,
      clientReportedPricePaise: 1,
    }]);

    expect(result.validation.isValid).toBe(true);
    expect(result.cartId).toBe('cart-uuid');
    expect(rpc).toHaveBeenCalledWith('sync_active_cart', {
      p_items: [{
        product_variant_id: 'ghee-red-cow-200ml',
        vendor_id: null,
        milk_type: null,
        quantity: 2,
        unit_price_paise: 17900,
        quantity_litres: null,
      }],
    });
  });

  it('does not write a cart when server validation rejects a line', async () => {
    const { client, rpc } = mockSupabase({
      product_variants: [],
      products: [],
      app_settings: [{ key: 'delivery_fee_paise', value: 400 }],
    });

    const result = await replaceAuthenticatedCart(client, [{
      key: 'catalogue:missing',
      productVariantId: 'missing-variant',
      quantity: 1,
    }]);

    expect(result.validation.isValid).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('clears the active cart with an atomic empty snapshot', async () => {
    const { client, rpc } = mockSupabase({});
    await clearAuthenticatedCart(client);
    expect(rpc).toHaveBeenCalledWith('sync_active_cart', { p_items: [] });
  });
});
