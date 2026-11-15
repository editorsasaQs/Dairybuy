import { NextResponse } from "next/server";
import { getDatabaseMilkCatalogue } from "@/lib/services/vendor-db-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Milk vendor service is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const catalogue = await getDatabaseMilkCatalogue(supabase);
    return NextResponse.json({
      success: true,
      data: {
        vendors: catalogue.vendors,
        count: catalogue.vendors.length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/vendors/milk] Failed to load database vendors:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load milk vendors right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
