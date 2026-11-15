import { NextResponse } from "next/server";
import { validateCheckout } from "@/lib/services/checkout-validation-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };

function unavailable() {
  return NextResponse.json(
    { success: false, error: "Checkout validation is temporarily unavailable." },
    { status: 503, headers },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return unavailable();

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401, headers },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload." },
        { status: 400, headers },
      );
    }

    if (!isRecord(body) ||
        typeof body["addressId"] !== "string" || !body["addressId"].trim() ||
        typeof body["deliverySlotId"] !== "string" || !body["deliverySlotId"].trim() ||
        typeof body["deliveryDate"] !== "string" || !body["deliveryDate"].trim()) {
      return NextResponse.json(
        {
          success: false,
          fieldErrors: {
            addressId: "Select a saved delivery address.",
            deliverySlotId: "Select a delivery slot.",
            deliveryDate: "Choose a delivery date.",
          },
        },
        { status: 400, headers },
      );
    }

    const result = await validateCheckout(supabase, user.id, {
      addressId: body["addressId"],
      deliverySlotId: body["deliverySlotId"],
      deliveryDate: body["deliveryDate"],
    });

    if (!result.valid) {
      return NextResponse.json(
        { success: false, fieldErrors: result.fieldErrors },
        { status: 422, headers },
      );
    }

    return NextResponse.json(
      { success: true, data: result.summary },
      { headers },
    );
  } catch (error) {
    console.error("[api/checkout/validate] Validation failed:", error);
    return unavailable();
  }
}
