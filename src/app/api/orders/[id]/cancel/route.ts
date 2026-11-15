import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }

  try {
    const { id } = await context.params;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404, headers });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    }

    const { data, error } = await supabase.rpc("cancel_customer_cod_order", { p_order_id: id });
    if (error) {
      console.error("[api/orders/[id]/cancel] Cancellation rejected:", error.code, error.message);
      if (error.code === "P0002") {
        return NextResponse.json({ success: false, error: "Order not found." }, { status: 404, headers });
      }
      const expected = ["22023", "23514", "42501"].includes(error.code ?? "");
      return NextResponse.json({
        success: false,
        error: expected ? error.message : "Unable to cancel this order right now. Please retry.",
      }, { status: expected ? 422 : 503, headers });
    }

    const result = Array.isArray(data) ? data[0] : null;
    if (!result?.order_id || result.resulting_status !== "cancelled") {
      return NextResponse.json({ success: false, error: "Cancellation could not be verified." }, { status: 503, headers });
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.order_id,
        status: result.resulting_status,
        alreadyCancelled: Boolean(result.was_already_cancelled),
      },
    }, { headers });
  } catch (error) {
    console.error("[api/orders/[id]/cancel] Cancellation failed:", error);
    return NextResponse.json({ success: false, error: "Order service is temporarily unavailable." }, { status: 503, headers });
  }
}
