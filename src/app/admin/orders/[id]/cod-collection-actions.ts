"use server";

import { revalidatePath } from "next/cache";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { isValidOrderId } from "@/lib/services/admin-order-filters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReviewCodCollectionState = {
  success: boolean;
  message: string;
  resultingStatus?: string;
  paymentStatus?: string;
};

export async function reviewCodCashCollectionAction(
  _previousState: ReviewCodCollectionState,
  formData: FormData,
): Promise<ReviewCodCollectionState> {
  const orderId = formData.get("orderId");
  const decision = formData.get("decision");
  const noteValue = formData.get("note");

  if (typeof orderId !== "string" || !isValidOrderId(orderId)) {
    return { success: false, message: "Invalid order reference. Refresh and try again." };
  }
  if (decision !== "verify" && decision !== "reject") {
    return { success: false, message: "Choose a valid review decision." };
  }
  const note = typeof noteValue === "string" ? noteValue.trim() : "";
  if (note.length > 500) {
    return { success: false, message: "The review note must be 500 characters or fewer." };
  }
  if (decision === "reject" && note.length < 5) {
    return { success: false, message: "Enter a rejection reason of at least 5 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Your session has expired. Please sign in again." };
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) {
    return { success: false, message: "Only an owner or admin can review COD collections." };
  }

  const { data, error } = await supabase.rpc("review_cod_cash_collection", {
    p_order_id: orderId,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) {
    if (error.code === "42501") {
      return { success: false, message: "You are not authorized to review this collection." };
    }
    if (error.code === "P0002") {
      return { success: false, message: "Order or COD collection not found. Refresh the page." };
    }
    if (error.code === "22023") {
      return { success: false, message: error.message.includes("reason")
        ? "A rejection reason of at least 5 characters is required."
        : "The review details are invalid. Check the note and try again." };
    }
    if (error.code === "23514") {
      return { success: false, message: error.message };
    }
    return { success: false, message: "The COD collection could not be reviewed. Refresh and try again." };
  }

  const result = data?.[0];
  if (!result) {
    return { success: false, message: "The server returned no review result. Refresh and try again." };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return {
    success: true,
    resultingStatus: result.collection_status,
    paymentStatus: result.payment_status,
    message: result.was_replayed
      ? `This ${decision} decision was already applied. The record is up to date.`
      : decision === "verify"
        ? "Cash verified. COD payment and order payment status are now captured."
        : "Collection rejected. Payment remains pending for reconciliation.",
  };
}
