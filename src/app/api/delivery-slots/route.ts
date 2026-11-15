import { NextResponse } from "next/server";
import { getDatabaseDeliverySlots } from "@/lib/services/delivery-config-service";
import { DELIVERY_TIME_ZONE } from "@/lib/services/delivery-time-service";
import {
  createSupabaseServerClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Delivery information is temporarily unavailable." },
      { status: 503, headers },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const slots = await getDatabaseDeliverySlots(supabase);

    return NextResponse.json(
      { success: true, data: { slots, timezone: DELIVERY_TIME_ZONE } },
      { headers },
    );
  } catch (error) {
    console.error("[api/delivery-slots] Failed to load delivery configuration:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load delivery information right now." },
      { status: 503, headers },
    );
  }
}
