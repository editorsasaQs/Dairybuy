import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const actions = new Set(["pause", "resume", "skip", "cancel", "change_vendor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Subscription service unavailable." }, { status: 503, headers });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const { data: subscriptions, error } = await supabase.from("subscriptions")
      .select("id,subscription_number,plan_type,status,start_date,end_date,next_delivery_date,duration_days,subtotal_paise,discount_paise,total_paise,paused_at,created_at,delivery_slot_id")
      .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const ids = (subscriptions ?? []).map((row) => row.id);
    const [itemsResult, deliveriesResult, slotsResult] = await Promise.all([
      ids.length ? supabase.from("subscription_items").select("id,subscription_id,product_variant_id,vendor_id,milk_type,quantity,quantity_litres,price_per_delivery_paise,product_name_snapshot,variant_name_snapshot,vendor_name_snapshot").in("subscription_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("subscription_deliveries").select("id,subscription_id,delivery_date,status,delivery_slot_id,delivery_notes,order_id").in("subscription_id", ids).order("delivery_date", { ascending: true }).limit(500) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("delivery_slots").select("id,label,start_time,end_time").in("id", [...new Set((subscriptions ?? []).map((row) => row.delivery_slot_id))]) : Promise.resolve({ data: [], error: null }),
    ]);
    if (itemsResult.error || deliveriesResult.error || slotsResult.error) throw new Error("Unable to load subscription details.");
    return NextResponse.json({ success: true, data: {
      subscriptions: subscriptions ?? [], items: itemsResult.data ?? [],
      deliveries: deliveriesResult.data ?? [], slots: slotsResult.data ?? [],
    } }, { headers });
  } catch (error) {
    console.error("[api/subscriptions] GET failed:", error);
    return NextResponse.json({ success: false, error: "Unable to load subscriptions right now." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Subscription service unavailable." }, { status: 503, headers });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400, headers }); }
    if (!isRecord(body) || typeof body["action"] !== "string" || !actions.has(body["action"]) ||
        typeof body["subscriptionId"] !== "string" || !uuidPattern.test(body["subscriptionId"])) {
      return NextResponse.json({ success: false, error: "A valid subscription action and ID are required." }, { status: 400, headers });
    }
    const id = body["subscriptionId"];
    let rpcName: string;
    let args: Record<string, string | null>;
    switch (body["action"]) {
      case "pause": rpcName = "pause_subscription"; args = { p_subscription_id: id }; break;
      case "resume": rpcName = "resume_subscription"; args = { p_subscription_id: id }; break;
      case "cancel":
        if (body["reason"] !== undefined && (typeof body["reason"] !== "string" || body["reason"].length > 300)) return NextResponse.json({ success: false, error: "Cancellation reason must be 300 characters or fewer." }, { status: 400, headers });
        rpcName = "cancel_subscription"; args = { p_subscription_id: id, p_reason: typeof body["reason"] === "string" ? body["reason"] : null }; break;
      case "skip":
        if (typeof body["skipDate"] !== "string" || !datePattern.test(body["skipDate"])) return NextResponse.json({ success: false, error: "Choose a valid delivery date." }, { status: 400, headers });
        if (body["reason"] !== undefined && (typeof body["reason"] !== "string" || body["reason"].length > 300)) return NextResponse.json({ success: false, error: "Skip reason must be 300 characters or fewer." }, { status: 400, headers });
        rpcName = "skip_subscription_delivery";
        args = { p_subscription_id: id, p_skip_date: body["skipDate"], p_reason: typeof body["reason"] === "string" ? body["reason"] : null, p_idempotency_key: crypto.randomUUID() }; break;
      case "change_vendor":
        if (typeof body["itemId"] !== "string" || !uuidPattern.test(body["itemId"]) || typeof body["vendorId"] !== "string" || !body["vendorId"].trim() || body["vendorId"].length > 100 || typeof body["effectiveFrom"] !== "string" || !datePattern.test(body["effectiveFrom"])) return NextResponse.json({ success: false, error: "A valid item, vendor and future effective date are required." }, { status: 400, headers });
        rpcName = "change_subscription_item_vendor";
        args = { p_subscription_id: id, p_subscription_item_id: body["itemId"], p_new_vendor_id: body["vendorId"], p_effective_from: body["effectiveFrom"], p_idempotency_key: crypto.randomUUID() }; break;
      default: return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400, headers });
    }
    const { data, error } = await supabase.rpc(rpcName as never, args as never);
    if (error) {
      const expected = ["22023", "23514", "23505", "42501", "P0002"].includes(error.code ?? "");
      return NextResponse.json({ success: false, error: expected ? error.message : "Subscription action could not be completed. Please retry." }, { status: expected ? 422 : 503, headers });
    }
    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) {
    console.error("[api/subscriptions] POST failed:", error);
    return NextResponse.json({ success: false, error: "Subscription action could not be completed." }, { status: 503, headers });
  }
}
