"use server";

import { revalidatePath } from "next/cache";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, admin: false };
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return { supabase, user, admin: !roleError && (roles ?? []).some((r) => isAdminOrOwner(r.role)) };
}

export async function resolveCodDiscrepancyAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "");
  const amountRupees = Number(formData.get("correctedAmountRupees"));
  const amount = Math.round(amountRupees * 100);
  const reason = String(formData.get("reason") ?? "").trim();
  const evidence = String(formData.get("evidenceReference") ?? "").trim();
  if (!UUID.test(orderId) || !Number.isFinite(amountRupees) || !Number.isSafeInteger(amount) || amount <= 0 || reason.length < 5 || reason.length > 500 || evidence.length > 200) {
    throw new Error("Enter a valid corrected cash amount, reason and evidence reference.");
  }
  const { supabase, user, admin } = await currentUser();
  if (!user || !admin) throw new Error("Only owner/admin can resolve COD discrepancies.");
  const { error } = await supabase.rpc("resolve_cod_collection_discrepancy", {
    p_order_id: orderId, p_corrected_amount_paise: amount, p_reason: reason, p_evidence_reference: evidence || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/finance/cod");
}

export async function reviewCashHandoverAction(formData: FormData) {
  const handoverId = String(formData.get("handoverId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!UUID.test(handoverId) || !["accept", "dispute"].includes(decision) || (decision === "dispute" && note.length < 5) || note.length > 500) {
    throw new Error("Invalid cash handover review details.");
  }
  const { supabase, user, admin } = await currentUser();
  if (!user || !admin) throw new Error("Only owner/admin can review cash handovers.");
  const { error } = await supabase.rpc("review_delivery_cash_handover", {
    p_handover_id: handoverId, p_decision: decision, p_note: note || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/cod");
}

export async function correctCashHandoverAction(formData: FormData) {
  const handoverId = String(formData.get("handoverId") ?? "");
  const amountRupees = Number(formData.get("correctedReceivedRupees"));
  const amount = Math.round(amountRupees * 100);
  const reason = String(formData.get("reason") ?? "").trim();
  const evidence = String(formData.get("evidenceReference") ?? "").trim();
  if (!UUID.test(handoverId) || !Number.isFinite(amountRupees) || !Number.isSafeInteger(amount) || amount < 0 || reason.length < 5 || reason.length > 500 || evidence.length > 200) {
    throw new Error("Enter a valid recounted amount, reason and evidence reference.");
  }
  const { supabase, user, admin } = await currentUser();
  if (!user || !admin) throw new Error("Only owner/admin can correct cash handovers.");
  const { error } = await supabase.rpc("correct_delivery_cash_handover", {
    p_handover_id: handoverId, p_corrected_received_amount_paise: amount,
    p_reason: reason, p_evidence_reference: evidence || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/cod");
}

export async function submitStaffCashHandoverAction(formData: FormData) {
  const collectionIds = formData.getAll("collectionIds").map(String);
  const receivedRupees = Number(formData.get("receivedAmountRupees"));
  const received = Math.round(receivedRupees * 100);
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!collectionIds.length || collectionIds.length > 200 || collectionIds.some((id) => !UUID.test(id))
    || !Number.isFinite(receivedRupees) || !Number.isSafeInteger(received) || received < 0 || !UUID.test(idempotencyKey)) {
    throw new Error("Select collections and enter the cash amount handed over.");
  }
  const { supabase, user } = await currentUser();
  if (!user) throw new Error("Sign in to submit a cash handover.");
  const { error } = await supabase.rpc("submit_delivery_cash_handover", {
    p_collection_ids: collectionIds, p_received_amount_paise: received, p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/delivery/cash-handover");
  revalidatePath("/admin/finance/cod");
}
