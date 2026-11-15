"use server";

import { revalidatePath } from "next/cache";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { isValidOrderId } from "@/lib/services/admin-order-filters";
import { getNextOrderStatus } from "@/lib/services/order-fulfillment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TransitionOrderState = {
  success: boolean;
  message: string;
  resultingStatus?: string;
};

export async function transitionOrderAction(
  _previousState: TransitionOrderState,
  formData: FormData,
): Promise<TransitionOrderState> {
  const orderId = formData.get("orderId");
  const currentStatus = formData.get("currentStatus");
  const noteValue = formData.get("note");

  if (typeof orderId !== "string" || !isValidOrderId(orderId)) {
    return { success: false, message: "Invalid order reference. Refresh the page and try again." };
  }
  if (typeof currentStatus !== "string") {
    return { success: false, message: "Order status is missing. Refresh the page and try again." };
  }

  const nextStatus = getNextOrderStatus(currentStatus);
  if (!nextStatus) {
    return { success: false, message: "This order has no further available status transition." };
  }

  const note = typeof noteValue === "string" ? noteValue.trim() : "";
  if (note.length > 500) {
    return { success: false, message: "The note must be 500 characters or fewer." };
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
    return { success: false, message: "You are not authorized to update orders." };
  }

  const { data, error } = await supabase.rpc("transition_one_time_cod_order", {
    p_order_id: orderId,
    p_next_status: nextStatus,
    p_note: note || null,
  });

  if (error) {
    if (error.code === "42501") {
      return { success: false, message: "You are not authorized to update this order." };
    }
    if (error.code === "P0002") {
      return { success: false, message: "Order not found. Refresh the order queue." };
    }
    if (error.code === "22023" || error.code === "23514") {
      return { success: false, message: "The order changed or this transition is no longer valid. Refresh and try again." };
    }
    return { success: false, message: "Order status could not be updated. Please refresh and try again." };
  }

  const result = data?.[0];
  if (!result) {
    return { success: false, message: "The server returned no order update. Refresh and try again." };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return {
    success: true,
    resultingStatus: result.resulting_status,
    message: result.was_already_applied
      ? "This status was already applied. The order is up to date."
      : `Order status updated to ${result.resulting_status.replaceAll("_", " ")}.`,
  };
}
