import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Subscription checkout unavailable." }, { status: 503, headers });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid checkout request." }, { status: 400, headers });
    const input = body as Record<string, unknown>;
    if (typeof input["addressId"] !== "string" || !uuidPattern.test(input["addressId"]) ||
        typeof input["deliverySlotId"] !== "string" || !uuidPattern.test(input["deliverySlotId"]) ||
        typeof input["startDate"] !== "string" || !datePattern.test(input["startDate"]) ||
        !["7_day", "30_day"].includes(String(input["planType"])) ||
        typeof input["idempotencyKey"] !== "string" || !uuidPattern.test(input["idempotencyKey"]) ||
        !Array.isArray(input["items"]) || input["items"].length < 1 || input["items"].length > 20) {
      return NextResponse.json({ success: false, error: "Choose a valid address, delivery slot, start date, fixed plan and milk items." }, { status: 400, headers });
    }
    const { data, error } = await supabase.rpc("create_subscription_payment_intent" as never, {
      p_address_id: input["addressId"],
      p_delivery_slot_id: input["deliverySlotId"],
      p_start_date: input["startDate"],
      p_plan_type: input["planType"],
      p_items: input["items"],
      p_idempotency_key: input["idempotencyKey"],
    } as never);
    if (error) {
      const expected = ["22023", "23514", "23505", "42501", "P0002"].includes(error.code ?? "");
      return NextResponse.json({ success: false, error: expected ? error.message : "Subscription checkout could not be completed." }, { status: expected ? 422 : 503, headers });
    }
    return NextResponse.json({ success: true, data }, { status: 201, headers });
  } catch (error) {
    console.error("[api/subscriptions/checkout] POST failed:", error);
    return NextResponse.json({ success: false, error: "Subscription checkout could not be completed." }, { status: 503, headers });
  }
}
