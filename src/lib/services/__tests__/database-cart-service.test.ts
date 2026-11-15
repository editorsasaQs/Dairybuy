import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { validateAndCalculateDatabaseCart } from '../database-cart-service';

function mockSupabase(rows: Record<string, unknown[]>): SupabaseClient<Database> {
  const client = {
    from(table: string) {
      const query = {
        select() { return this; },
        in() { return this; },
        eq() { return this; },
        is() { return this; },
        lte() { return this; },
        maybeSingle() { return Promise.resolve({ data: rows[table]?.[0] ?? null, error: null }); },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

const cowVariants = [
  { id:'milk-cow-500ml', product_id:'milk-cow', variant_name:'Cow Milk 500 ml', brand:'Dairybuy Standard', unit_quantity:0.5, final_price_paise:null, is_orderable:true },
  { id:'milk-cow-1l', product_id:'milk-cow', variant_name:'Cow Milk 1 L', brand:'Dairybuy Standard', unit_quantity:1, final_price_paise:null, is_orderable:true },
];
const cowPrices = [
  { vendor_id:'healthy-haryana', product_variant_id:'milk-cow-500ml', milk_type:'cow', price_per_delivery_paise:4100, delivery_fee_paise:900, total_customer_delivery_paise:5000, is_current:true, effective_from:'2026-01-01T00:00:00.000Z', effective_to:null },
  { vendor_id:'healthy-haryana', product_variant_id:'milk-cow-1l', milk_type:'cow', price_per_delivery_paise:7800, delivery_fee_paise:700, total_customer_delivery_paise:8500, is_current:true, effective_from:'2026-01-01T00:00:00.000Z', effective_to:null },
];

function milkRows(vendorEnabled = true) {
  return {
    product_variants: cowVariants,
    products: [{ id:'milk-cow', name:'Cow Milk', product_type:'standard_milk', is_active:true }],
    vendors: [{ id:'healthy-haryana', name:'Healthy Haryana', is_approved:true, ordering_enabled:vendorEnabled, vendor_type:'milk_vendor' }],
    vendor_products: [{ vendor_id:'healthy-haryana', product_id:'milk-cow', milk_type:'cow', is_active:true }],
    vendor_prices: cowPrices,
  };
}

describe('database-authoritative cart pricing', () => {
  it('uses the current CSV final price and ignores browser-supplied prices', async () => {
    const result = await validateAndCalculateDatabaseCart(mockSupabase(milkRows()), [{
      key:'line-1', productVariantId:'milk-cow-1l', vendorId:'healthy-haryana',
      milkType:'cow', litres:1, quantity:2, clientReportedPricePaise:1,
    }]);
    expect(result.isValid).toBe(true);
    expect(result.items[0]?.unitPricePaise).toBe(8500);
    expect(result.subtotalPaise).toBe(17000);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(17000);
  });

  it('calculates 1.5 L from the 1 L and 500 ml base rows with one 1 L component', async () => {
    const result = await validateAndCalculateDatabaseCart(mockSupabase(milkRows()), [{
      key:'line-1', productVariantId:'milk-cow-1l', vendorId:'healthy-haryana',
      milkType:'cow', litres:1.5, quantity:1,
    }]);
    expect(result.isValid).toBe(true);
    expect(result.items[0]?.unitPricePaise).toBe(12600);
    expect(result.totalPaise).toBe(12600);
  });

  it('uses final catalogue price for non-milk products without adding another fee', async () => {
    const result = await validateAndCalculateDatabaseCart(mockSupabase({
      product_variants: [{ id:'ghee-red-cow-200ml', product_id:'ghee-red-cow', variant_name:'Red Cow Ghee 200 ml', brand:'Red Cow', unit_quantity:0.2, final_price_paise:17900, is_orderable:true }],
      products: [{ id:'ghee-red-cow', name:'Red Cow Ghee', product_type:'grocery_dairy', is_active:true }],
    }), [{ key:'line-1', productVariantId:'ghee-red-cow-200ml', quantity:1, clientReportedPricePaise:1 }]);
    expect(result.isValid).toBe(true);
    expect(result.subtotalPaise).toBe(17900);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(17900);
  });

  it('rejects disabled vendors even when mappings and prices exist', async () => {
    const result = await validateAndCalculateDatabaseCart(mockSupabase(milkRows(false)), [{
      key:'line-1', productVariantId:'milk-cow-1l', vendorId:'healthy-haryana',
      milkType:'cow', litres:1, quantity:1,
    }]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('not currently accepting orders');
  });

  it('rejects unsupported volume increments and quantities above 10 L', async () => {
    for (const litres of [0.75,10.5]) {
      const result = await validateAndCalculateDatabaseCart(mockSupabase(milkRows()), [{
        key:'line-1', productVariantId:'milk-cow-1l', vendorId:'healthy-haryana',
        milkType:'cow', litres, quantity:1,
      }]);
      expect(result.isValid).toBe(false);
    }
  });
});
