import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type IntegrationProbe = {
  status: "ok" | "error";
  count: number | null;
};

export type DatabaseIntegrationHealth = {
  database: IntegrationProbe;
  catalogue: IntegrationProbe;
  approvedVendors: IntegrationProbe;
  vendorProducts: IntegrationProbe;
  currentVendorPrices: IntegrationProbe;
  orderableVariants: IntegrationProbe;
  serviceAreas: IntegrationProbe;
  deliverySlots: IntegrationProbe;
};

async function probe(
  createQuery: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<IntegrationProbe> {
  try {
    const result = await createQuery();
    return result.error
      ? { status: "error", count: null }
      : { status: "ok", count: result.count };
  } catch {
    return { status: "error", count: null };
  }
}

/**
 * Read-only connectivity checks for every customer-facing database integration.
 * Uses the configured publishable/anon client and respects the same RLS as APIs.
 */
export async function checkDatabaseIntegrations(
  supabase: Client,
): Promise<DatabaseIntegrationHealth> {
  const [
    database,
    catalogue,
    approvedVendors,
    vendorProducts,
    currentVendorPrices,
    orderableVariants,
    serviceAreas,
    deliverySlots,
  ] = await Promise.all([
    probe(() => supabase.from("service_area_pincodes").select("id", { count: "exact", head: true })),
    probe(() => supabase.from("public_catalogue").select("variant_id", { count: "exact", head: true })),
    probe(() =>
      supabase
        .from("vendors")
        .select("id", { count: "exact", head: true })
        .eq("is_approved", true),
    ),
    probe(() =>
      supabase
        .from("vendor_products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ),
    probe(() =>
      supabase
        .from("vendor_prices")
        .select("id", { count: "exact", head: true })
        .eq("is_current", true),
    ),
    probe(() =>
      supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("is_orderable", true),
    ),
    probe(() =>
      supabase
        .from("service_areas")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ),
    probe(() =>
      supabase
        .from("delivery_slots")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ),
  ]);

  return {
    database,
    catalogue,
    approvedVendors,
    vendorProducts,
    currentVendorPrices,
    orderableVariants,
    serviceAreas,
    deliverySlots,
  };
}

export function areDatabaseIntegrationsHealthy(
  checks: DatabaseIntegrationHealth,
): boolean {
  return Object.values(checks).every((check) => check.status === "ok");
}
