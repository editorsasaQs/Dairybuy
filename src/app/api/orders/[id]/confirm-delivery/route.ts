import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }

  try {
    const { id } = await context.params;
    if (!uuidPattern.test(id)) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404, headers });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    }

    const { data, error } = await supabase.rpc("transition_one_time_cod_order", {
      p_order_id: id,
      p_next_status: "delivered",
      p_note: null,
    });
    if (error) {
      if (error.code === "P0002") {
        return NextResponse.json({ success: false, error: "Order not found." }, { status: 404, headers });
      }
      if (error.code === "42501") {
        return NextResponse.json({ success: false, error: "You are not authorized to confirm this order." }, { status: 403, headers });
      }
      if (error.code === "23514") {
        return NextResponse.json({ success: false, error: error.message }, { status: 409, headers });
      }
      if (error.code === "22023") {
        return NextResponse.json({ success: false, error: error.message }, { status: 400, headers });
      }
      return NextResponse.json({
        success: false,
        error: "Delivery confirmation could not be completed. Please retry.",
      }, { status: 503, headers });
    }

    const result = Array.isArray(data) ? data[0] : null;
    if (!result?.order_id || result.resulting_status !== "delivered") {
      return NextResponse.json({ success: false, error: "Delivery confirmation could not be verified." }, { status: 503, headers });
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.order_id,
        status: result.resulting_status,
        alreadyDelivered: Boolean(result.was_already_applied),
      },
    }, { headers });
  } catch (error) {
    console.error("[api/orders/[id]/confirm-delivery] Confirmation failed:", error);
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }
}
