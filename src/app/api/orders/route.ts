import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    }

    const { data, error } = await supabase.from("orders")
      .select("id,order_number,status,payment_status,payment_method,subtotal_paise,delivery_fee_paise,total_paise,delivery_date,delivery_slot_id,created_at")
      .eq("customer_id", user.id)
      .eq("order_type", "one_time")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[api/orders] Order history read failed:", error.message);
      return NextResponse.json({ success: false, error: "Unable to load your orders right now." }, { status: 503, headers });
    }
    return NextResponse.json({ success: true, data: { orders: data ?? [] } }, { headers });
  } catch (error) {
    console.error("[api/orders] Order history failed:", error);
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    }

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400, headers }); }

    if (!isRecord(body) ||
        typeof body["addressId"] !== "string" || !uuidPattern.test(body["addressId"]) ||
        typeof body["deliverySlotId"] !== "string" || !uuidPattern.test(body["deliverySlotId"]) ||
        typeof body["deliveryDate"] !== "string" || !datePattern.test(body["deliveryDate"]) ||
        typeof body["idempotencyKey"] !== "string" || !uuidPattern.test(body["idempotencyKey"]) ||
        (body["deliveryNotes"] !== undefined && body["deliveryNotes"] !== null &&
          (typeof body["deliveryNotes"] !== "string" || body["deliveryNotes"].length > 500))) {
      return NextResponse.json({ success: false, error: "Address, delivery slot, delivery date and a valid idempotency key are required." }, { status: 400, headers });
    }

    const { data, error } = await supabase.rpc("create_cod_order", {
      p_address_id: body["addressId"],
      p_delivery_slot_id: body["deliverySlotId"],
      p_delivery_date: body["deliveryDate"],
      p_idempotency_key: body["idempotencyKey"],
      p_delivery_notes: typeof body["deliveryNotes"] === "string" ? body["deliveryNotes"] : null,
    });
    if (error) {
      console.error("[api/orders] COD order RPC rejected:", error.code, error.message);
      const expected = ["22023", "23514", "P0001", "22003", "42501"].includes(error.code ?? "");
      return NextResponse.json({
        success: false,
        error: expected ? error.message : "Unable to place your order right now. Please retry.",
      }, { status: expected ? 422 : 503, headers });
    }
    const order = Array.isArray(data) ? data[0] : null;
    if (!order?.order_id || !order.order_number || typeof order.total_paise !== "number") {
      return NextResponse.json({ success: false, error: "Order confirmation could not be verified." }, { status: 503, headers });
    }
    return NextResponse.json({
      success: true,
      data: {
        orderId: order.order_id,
        orderNumber: order.order_number,
        totalPaise: order.total_paise,
        paymentMethod: "cod",
        paymentStatus: "pending",
        status: "pending_confirmation",
        replayed: Boolean(order.was_replayed),
      },
    }, { status: order.was_replayed ? 200 : 201, headers });
  } catch (error) {
    console.error("[api/orders] Order placement failed:", error);
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }
}
