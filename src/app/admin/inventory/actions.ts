"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Your session has expired. Please sign in again.");
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) {
    throw new Error("Only owner/admin can manage physical inventory.");
  }
  return supabase;
}

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export type InventoryActionState = { success: boolean; message: string };\n\nconst failure = (message: string): InventoryActionState => ({ success: false, message });\n\nexport async function receiveInventoryAction(_previous: InventoryActionState, formData: FormData): Promise<InventoryActionState> {
  const vendorId = textField(formData, "vendorId");
  const areaId = textField(formData, "areaId");
  const vendorReference = textField(formData, "vendorReference");
  const notes = textField(formData, "notes");
  const idempotencyKey = textField(formData, "idempotencyKey");
  const variantIds = formData.getAll("variantId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const costs = formData.getAll("unitCostRupees").map(String);

  if (!vendorId || !UUID.test(areaId) || !UUID.test(idempotencyKey) || variantIds.length < 1 || variantIds.length > 100
    || quantities.length !== variantIds.length || costs.length !== variantIds.length
    || vendorReference.length > 120 || notes.length > 500) {
    return failure("Complete the vendor, service area and valid receipt details.");
  }

  const items: Json[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < variantIds.length; i++) {
    const variantId = variantIds[i].trim();
    const quantity = Number(quantities[i]);
    const rupees = Number(costs[i]);
    const unitCostPaise = Math.round(rupees * 100);
    if (!variantId || seen.has(variantId) || !Number.isSafeInteger(quantity) || quantity <= 0
      || !Number.isFinite(rupees) || rupees < 0 || !Number.isSafeInteger(unitCostPaise)) {
      return failure("Each receipt line needs a unique SKU, positive whole quantity and valid non-negative unit cost.");
    }
    seen.add(variantId);
    items.push({ product_variant_id: variantId, quantity, unit_cost_paise: unitCostPaise });
  }

  const supabase = await authorizedClient();
  const { data, error } = await supabase.rpc("receive_inventory_stock", {
    p_vendor_id: vendorId,
    p_service_area_id: areaId,
    p_vendor_reference: vendorReference || null,
    p_notes: notes || null,
    p_items: items,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const result = data?.[0];
  if (!result) throw new Error("The database returned no stock receipt.");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/audit");
  redirect(`/admin/inventory?received=${encodeURIComponent(result.receipt_number)}`);
}

export async function adjustInventoryAction(formData: FormData) {
  const inventoryId = textField(formData, "inventoryId");
  const adjustmentType = textField(formData, "adjustmentType");
  const quantity = Number(textField(formData, "quantity"));
  const reason = textField(formData, "reason");
  const evidence = textField(formData, "evidenceReference");
  const idempotencyKey = textField(formData, "idempotencyKey");

  if (!UUID.test(inventoryId) || !UUID.test(idempotencyKey)
    || !["spoilage", "damage", "stocktake_adjustment"].includes(adjustmentType)
    || !Number.isSafeInteger(quantity) || quantity === 0
    || (adjustmentType !== "stocktake_adjustment" && quantity < 0)
    || reason.length < 5 || reason.length > 500 || evidence.length > 200) {
    return failure("Enter a valid adjustment type, quantity and reason. Spoilage/damage quantities must be positive.");
  }

  const supabase = await authorizedClient();
  const { data, error } = await supabase.rpc("adjust_inventory_stock", {
    p_inventory_id: inventoryId,
    p_adjustment_type: adjustmentType,
    p_quantity: quantity,
    p_reason: reason,
    p_evidence_reference: evidence || null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const result = data?.[0];
  if (!result) throw new Error("The database returned no stock adjustment.");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/audit");
  redirect(`/admin/inventory?adjusted=${encodeURIComponent(result.adjustment_number)}`);
}
