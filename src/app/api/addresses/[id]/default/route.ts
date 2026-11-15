import { NextResponse } from "next/server";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Address service is unavailable." }, { status: 503, headers });
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const { error } = await supabase.rpc("set_customer_default_address", { p_address_id: id });
    if (error) {
      if (error.code === "P0002") return NextResponse.json({ success: false, error: "Address not found." }, { status: 404, headers });
      if (error.code === "42501") return NextResponse.json({ success: false, error: "Not authorized to change this address." }, { status: 403, headers });
      throw error;
    }
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error("[api/addresses/default] POST failed:", error);
    return NextResponse.json({ success: false, error: "Unable to set default address." }, { status: 503, headers });
  }
}
