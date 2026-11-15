import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Subscription quote service unavailable." }, { status: 503, headers });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid quote request." }, { status: 400, headers });
    const input = body as Record<string, unknown>;
    if (typeof input.addressId !== "string" || !uuidPattern.test(input.addressId) ||
        typeof input.deliverySlotId !== "string" || !uuidPattern.test(input.deliverySlotId) ||
        typeof input.startDate !== "string" || !datePattern.test(input.startDate) ||
        !["7_day", "30_day"].includes(String(input.planType)) ||
        !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
      return NextResponse.json({ success: false, error: "Choose an address, delivery slot, start date, fixed plan and at least one milk item." }, { status: 400, headers });
    }
    for (const item of input.items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return NextResponse.json({ success: false, error: "Invalid milk item." }, { status: 400, headers });
      const line = item as Record<string, unknown>;
      if (typeof line.product_variant_id !== "string" || line.product_variant_id.length > 100 ||
          typeof line.vendor_id !== "string" || line.vendor_id.length > 100 ||
          !["cow", "buffalo", "canteen"].includes(String(line.milk_type)) ||
          !Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 100 ||
          typeof line.quantity_litres !== "number" || line.quantity_litres < 0.5 || line.quantity_litres > 10 || line.quantity_litres * 2 !== Math.trunc(line.quantity_litres * 2)) {
        return NextResponse.json({ success: false, error: "Milk selections must use an approved vendor and 0.5–10 L in 0.5 L increments." }, { status: 400, headers });
      }
    }
    const { data, error } = await supabase.rpc("quote_subscription", {
      p_address_id: input.addressId,
      p_delivery_slot_id: input.deliverySlotId,
      p_start_date: input.startDate,
      p_plan_type: input.planType as "7_day" | "30_day",
      p_items: input.items as never,
    });
    if (error) {
      const expected = ["22023", "23514", "42501", "22003"].includes(error.code ?? "");
      return NextResponse.json({ success: false, error: expected ? error.message : "Unable to calculate subscription quote." }, { status: expected ? 422 : 503, headers });
    }
    return NextResponse.json({ success: true, data: { quote: data } }, { headers });
  } catch (error) {
    console.error("[api/subscriptions/quote] POST failed:", error);
    return NextResponse.json({ success: false, error: "Unable to calculate subscription quote." }, { status: 503, headers });
  }
}
