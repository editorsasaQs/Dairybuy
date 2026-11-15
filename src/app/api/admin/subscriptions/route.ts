import { NextResponse } from "next/server";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Operations service unavailable." }, { status: 503, headers });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleNames = (roles ?? []).map((row) => row.role);
    const admin = !roleError && roleNames.some((role) => isAdminOrOwner(role));
    const staff = !roleError && roleNames.some((role) => ["owner", "admin", "manager", "operations_staff"].includes(role));
    if (!staff) return NextResponse.json({ success: false, error: "Authorized delivery staff access required." }, { status: 403, headers });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400, headers });
    const input = body as Record<string, unknown>;
    if (typeof input["deliveryId"] !== "string" || !uuidPattern.test(input["deliveryId"]) || typeof input["action"] !== "string") return NextResponse.json({ success: false, error: "A valid delivery and action are required." }, { status: 400, headers });
    let rpc: string;
    let args: Record<string, string>;
    switch (input["action"]) {
      case "assign":
        if (!admin) return NextResponse.json({ success: false, error: "Only owner/admin can assign deliveries." }, { status: 403, headers });
        if (typeof input["staffId"] !== "string" || !uuidPattern.test(input["staffId"])) return NextResponse.json({ success: false, error: "Choose a valid delivery staff account." }, { status: 400, headers });
        rpc = "assign_subscription_delivery"; args = { p_delivery_id: input["deliveryId"], p_staff_id: input["staffId"] }; break;
      case "start": rpc = "start_subscription_delivery"; args = { p_delivery_id: input["deliveryId"] }; break;
      case "complete": rpc = "complete_subscription_delivery"; args = { p_delivery_id: input["deliveryId"] }; break;
      case "record_cod": {
        const amountRupees = Number(input["amountRupees"]);
        const amountPaise = Math.round(amountRupees * 100);
        if (!Number.isFinite(amountRupees) || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) return NextResponse.json({ success: false, error: "Enter the positive cash amount received in rupees." }, { status: 400, headers });
        const { data: delivery, error: deliveryError } = await supabase.from("subscription_deliveries")
          .select("order_id").eq("id", input["deliveryId"]).eq("assigned_staff_id", user.id).eq("status", "delivered").maybeSingle();
        if (deliveryError || !delivery?.order_id) return NextResponse.json({ success: false, error: "Only your completed subscription delivery can accept cash." }, { status: 403, headers });
        const { data, error } = await supabase.rpc("record_cod_cash_collection" as never, {
          p_order_id: delivery.order_id, p_amount_collected_paise: amountPaise,
          p_receipt_reference: null, p_collection_notes: "Subscription delivery cash recorded by assigned staff",
        } as never);
        if (error) {
          const expected = ["22023", "23514", "23505", "42501", "P0002"].includes(error.code ?? "");
          return NextResponse.json({ success: false, error: expected ? error.message : "Cash collection could not be recorded." }, { status: expected ? 422 : 503, headers });
        }
        return NextResponse.json({ success: true, data }, { headers });
      }
      case "verify_cod":
      case "reject_cod": {
        if (!admin) return NextResponse.json({ success: false, error: "Only owner/admin can review subscription COD collections." }, { status: 403, headers });
        const decision = input["action"] === "verify_cod" ? "verify" : "reject";
        const note = typeof input["reason"] === "string" ? input["reason"].trim() : "";
        if (decision === "reject" && (note.length < 5 || note.length > 500)) return NextResponse.json({ success: false, error: "A rejection reason of 5–500 characters is required." }, { status: 400, headers });
        const { data: delivery, error: deliveryError } = await supabase.from("subscription_deliveries")
          .select("order_id").eq("id", input["deliveryId"]).maybeSingle();
        if (deliveryError || !delivery?.order_id) return NextResponse.json({ success: false, error: "Subscription delivery order not found." }, { status: 404, headers });
        const { data, error } = await supabase.rpc("review_cod_cash_collection" as never, {
          p_order_id: delivery.order_id, p_decision: decision, p_note: decision === "reject" ? note : null,
        } as never);
        if (error) {
          const expected = ["22023", "23514", "42501", "P0002"].includes(error.code ?? "");
          return NextResponse.json({ success: false, error: expected ? error.message : "COD collection review failed." }, { status: expected ? 422 : 503, headers });
        }
        return NextResponse.json({ success: true, data }, { headers });
      }
      case "fail":
        if (!admin) return NextResponse.json({ success: false, error: "Only owner/admin can resolve failed deliveries." }, { status: 403, headers });
        if (typeof input["reason"] !== "string" || !input["reason"].trim() || input["reason"].length > 500) return NextResponse.json({ success: false, error: "A failure reason of 1–500 characters is required." }, { status: 400, headers });
        rpc = "fail_subscription_delivery"; args = { p_delivery_id: input["deliveryId"], p_reason: input["reason"].trim() }; break;
      default: return NextResponse.json({ success: false, error: "Unsupported delivery action." }, { status: 400, headers });
    }
    const { data, error } = await supabase.rpc(rpc as never, args as never);
    if (error) {
      const expected = ["22023", "23514", "42501", "P0002"].includes(error.code ?? "");
      return NextResponse.json({ success: false, error: expected ? error.message : "Delivery operation failed. Please retry." }, { status: expected ? 422 : 503, headers });
    }
    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) {
    console.error("[api/admin/subscriptions] POST failed:", error);
    return NextResponse.json({ success: false, error: "Delivery operation failed." }, { status: 503, headers });
  }
}
