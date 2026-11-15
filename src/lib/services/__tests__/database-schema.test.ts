import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Database Schema & Migration Validation', () => {
  const schemaFile = join(root, 'supabase', 'migrations', '20261105152416_phase4_schema.sql');
  const seedFile = join(root, 'supabase', 'migrations', '20261105170122_phase4_seed.sql');
  const rlsFile = join(root, 'supabase', 'migrations', '20261105170726_phase4_rls.sql');
  const phase41File = join(root, 'supabase', 'migrations', '20261105170948_phase4_1_confirmed_csv_catalogue.sql');
  const vendorRemovalFile = join(root, 'supabase', 'migrations', '20261112095741_remove_unpriced_milk_vendors.sql');

  it('verifies that all Phase 4 and Phase 4.1 migration files exist', () => {
    expect(existsSync(schemaFile)).toBe(true);
    expect(existsSync(seedFile)).toBe(true);
    expect(existsSync(rlsFile)).toBe(true);
    expect(existsSync(phase41File)).toBe(true);
    expect(existsSync(vendorRemovalFile)).toBe(true);
  });

  it('verifies that all required normalized tables exist in the schema migration', () => {
    const sql = readFileSync(schemaFile, 'utf8');

    const expectedTables = [
      // IDENTITY
      'profiles',
      'user_roles',
      'staff_permissions',
      'customer_addresses',
      // SERVICEABILITY
      'service_areas',
      'service_area_pincodes',
      'delivery_slots',
      'app_settings',
      // CATALOGUE
      'categories',
      'products',
      'product_variants',
      'product_images',
      // VENDORS
      'vendors',
      'vendor_products',
      'vendor_prices',
      // INVENTORY
      'inventory',
      'inventory_movements',
      // COMMERCE
      'carts',
      'cart_items',
      'orders',
      'order_items',
      'order_status_history',
      'subscriptions',
      'subscription_items',
      'subscription_deliveries',
      'subscription_skip_records',
      'subscription_vendor_changes',
      'payments',
      'refunds',
      'payment_webhook_events',
      'cod_collections',
      'delivery_assignments',
      'notifications',
      'audit_logs',
    ];

    for (const table of expectedTables) {
      expect(
        sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
        `Missing table in schema: ${table}`,
      ).toBe(true);
    }
    expect(expectedTables).toHaveLength(34);
  });

  it('verifies that RLS is enabled on all tables in the RLS migration', () => {
    const rlsSql = readFileSync(rlsFile, 'utf8');

    const tablesToCheck = [
      'profiles',
      'user_roles',
      'staff_permissions',
      'customer_addresses',
      'service_areas',
      'categories',
      'products',
      'product_variants',
      'vendors',
      'vendor_prices',
      'inventory',
      'carts',
      'cart_items',
      'orders',
      'order_items',
      'subscriptions',
      'payments',
      'audit_logs',
    ];

    for (const table of tablesToCheck) {
      expect(
        rlsSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
        `RLS not enabled on table: ${table}`,
      ).toBe(true);
    }
    const enabledTables = [...rlsSql.matchAll(/ALTER TABLE public\.([a-z_]+) ENABLE ROW LEVEL SECURITY;/g)];
    expect(enabledTables).toHaveLength(34);
  });

  it('verifies that the seed file populates the confirmed vendors, Canteen Milk Centre, and 16 non-milk variants', () => {
    const seedSql = readFileSync(seedFile, 'utf8');

    // Vendors
    expect(seedSql).toContain('healthy-haryana');
    expect(seedSql).toContain('vip-pure');
    expect(seedSql).toContain('ghosh-dairy');
    expect(seedSql).toContain('canteen-milk-centre');

    // Topsia launch area
    expect(seedSql).toContain('topsia-kolkata');
    expect(seedSql).toContain('700046');

    // All 16 non-milk variants present
    const nonMilkVariantKeys = [
      'ghee-red-cow-200ml',
      'ghee-red-cow-500ml',
      'ghee-ashirvaad-200ml',
      'ghee-ashirvaad-500ml',
      'butter-amul-100g',
      'butter-amul-200g',
      'butter-amul-500g',
      'butter-delicious-100g',
      'butter-delicious-500g',
      'cheese-amul-slices-100g',
      'cheese-amul-slices-200g',
      'cheese-amul-blocs-200g',
      'cheese-amul-blocs-500g',
      'doi-misti-100g',
      'doi-tok-100g',
      'sweet-firni-1pc',
    ];

    for (const key of nonMilkVariantKeys) {
      expect(seedSql).toContain(key);
    }
  });
  it('removes the two unpriced vendors and their mappings with a guarded forward migration', () => {
    const sql = readFileSync(vendorRemovalFile, 'utf8');
    expect(sql).toContain("DELETE FROM public.vendor_products");
    expect(sql).toContain("DELETE FROM public.vendors");
    expect(sql).toContain("'fresh-punjab'");
    expect(sql).toContain("'kolkata-centre'");
    expect(sql).toContain('historical commerce references exist');
  });
});

describe('Phase 4.2 authenticated cart persistence migration', () => {
  const migrationFile = join(root, 'supabase', 'migrations', '20261106113620_phase4_2_authenticated_cart_persistence.sql');

  it('creates one active customer cart and one unique line selection per cart', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('uq_carts_one_active_per_customer');
    expect(sql).toContain("WHERE customer_id IS NOT NULL AND status = 'active'");
    expect(sql).toContain('uq_cart_items_line_selection');
    expect(sql).toContain('NULLS NOT DISTINCT');
  });

  it('uses an authenticated invoker RPC to replace the complete cart atomically', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('FUNCTION public.sync_active_cart(p_items jsonb)');
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('ON CONFLICT (customer_id) WHERE customer_id IS NOT NULL AND status = \'active\'');
    expect(sql).toContain('DELETE FROM public.cart_items WHERE cart_id = v_cart_id');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.sync_active_cart(jsonb) TO authenticated');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.sync_active_cart(jsonb) FROM PUBLIC, anon');
  });

  it('enforces line count, quantity and duplicate-selection bounds in the database', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('v_item_count > 50');
    expect(sql).toContain('item.quantity > 100');
    expect(sql).toContain('HAVING pg_catalog.count(*) > 1');
  });

  it('uses a private trigger to reject direct RPC price or vendor tampering', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('FUNCTION private.validate_cart_item_snapshot()');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('cart_items_validate_snapshot');
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF cart_id, product_variant_id');
    expect(sql).toContain('NEW.unit_price_paise IS DISTINCT FROM v_current_price');
    expect(sql).toContain('REVOKE ALL ON FUNCTION private.validate_cart_item_snapshot()');
  });
});

describe('Phase 4.1 confirmed CSV catalogue scope', () => {
  const seedFile = join(root, 'supabase', 'migrations', '20261105170122_phase4_seed.sql');
  const phase41File = join(root, 'supabase', 'migrations', '20261105170948_phase4_1_confirmed_csv_catalogue.sql');

  it('does not seed unconfirmed breakfast staples as active products', () => {
    const seedSql = readFileSync(seedFile, 'utf8');
    for (const id of ['bread-white', 'eggs-farm', 'banana-robusta', 'juice-fruit', 'jam-fruit']) {
      expect(seedSql).not.toContain(`'${id}'`);
    }
  });

  it('contains a forward migration to disable previously seeded unconfirmed products', () => {
    const migration = readFileSync(phase41File, 'utf8');
    expect(migration).toContain('SET is_orderable = FALSE');
    expect(migration).toContain('SET is_active = FALSE');
    expect(migration).toContain("'morning-essentials'");
  });
});

describe('Phase 2 CSV-authoritative pricing migration', () => {
  const migrationFile = join(root, 'supabase', 'migrations', '20261110161353_phase2_csv_authoritative_pricing.sql');

  it('adds selected milk volume snapshots and subscription-level discount totals', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS quantity_litres NUMERIC(4,1)');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('chk_subscription_price_snapshot');
  });

  it('replaces the flat delivery fee with CSV-inclusive customer prices', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain("SET value = '0'::jsonb");
    expect(sql).toContain("('healthy-haryana','milk-cow-500ml','cow',4100,35000,150000,900,5000");
    expect(sql).toContain("('canteen-milk-centre','milk-canteen-1l','canteen',5200,42000,180000,800,6000");
    expect(sql).toContain('total_customer_delivery_paise');
    expect(sql).toContain('quantity_litres');
  });

  it('keeps cart replacement owner-scoped and validates prices in a private trigger', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('FUNCTION private.validate_cart_item_snapshot()');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.sync_active_cart(jsonb) TO authenticated');
  });

  it('enforces the monthly discount once per complete 30-day subscription', () => {
    const sql = readFileSync(join(root, 'supabase', 'migrations', '20261110162034_enforce_subscription_discount_policy.sql'), 'utf8');
    expect(sql).toContain("plan_type = '30_day'");
    expect(sql).toContain('discount_paise = 6000');
    expect(sql).toContain("plan_type <> '30_day'");
  });

  it('applies the monthly ₹60 discount once at the subscription header', () => {
    const sql = readFileSync(migrationFile, 'utf8');
    expect(sql).toContain('subtotal_paise');
    expect(sql).toContain('discount_paise');
    expect(sql).toContain('total_paise = subtotal_paise - discount_paise');
  });
});
