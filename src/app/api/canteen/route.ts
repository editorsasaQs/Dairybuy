import { NextResponse } from "next/server";
import { getDatabaseMilkCatalogue } from "@/lib/services/vendor-db-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Canteen milk service is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const catalogue = await getDatabaseMilkCatalogue(supabase);
    if (!catalogue.canteen) {
      return NextResponse.json(
        { success: false, error: "Canteen milk is currently unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        vendor: catalogue.canteen,
        singleVendorArrangement: true,
        productType: "canteen_milk",
        pricing: catalogue.canteen.pricing,
        note: "Delivery fee is included in the customer total per delivery.",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/canteen] Failed to load database canteen pricing:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load canteen milk right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
