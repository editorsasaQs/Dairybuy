import { NextResponse } from "next/server";
import { parseAddressInput, resolveServiceAreaId } from "@/lib/services/customer-address-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Address service is unavailable." }, { status: 503, headers });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const { data, error } = await supabase.from("customer_addresses")
      .select("id,address_type,recipient_name,phone,address_line1,address_line2,landmark,city,state,pincode,service_area_id,is_default,created_at,updated_at")
      .eq("customer_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, data: { addresses: data ?? [] } }, { headers });
  } catch (error) {
    console.error("[api/addresses] GET failed:", error);
    return NextResponse.json({ success: false, error: "Unable to load addresses." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Address service is unavailable." }, { status: 503, headers });
  try {
    const body: unknown = await request.json();
    const input = parseAddressInput(body);
    if (!input) return NextResponse.json({ success: false, error: "Provide a valid name, phone, address and six-digit pincode." }, { status: 400, headers });
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const serviceAreaId = await resolveServiceAreaId(supabase, input.pincode);
    if (!serviceAreaId) return NextResponse.json({ success: false, error: "This pincode is outside Dairybuy's active delivery area." }, { status: 422, headers });
    const { count, error: countError } = await supabase.from("customer_addresses")
      .select("id", { count: "exact", head: true }).eq("customer_id", user.id);
    if (countError) throw countError;
    const { data, error } = await supabase.from("customer_addresses").insert({
      customer_id: user.id,
      address_type: input.addressType,
      recipient_name: input.recipientName,
      phone: input.phone,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2,
      landmark: input.landmark,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      service_area_id: serviceAreaId,
      is_default: false,
    }).select().single();
    if (error) throw error;
    if ((count ?? 0) === 0) {
      const { error: defaultError } = await supabase.rpc("set_customer_default_address", { p_address_id: data.id });
      if (defaultError) throw defaultError;
      const { data: refreshed, error: refreshError } = await supabase.from("customer_addresses")
        .select("*").eq("id", data.id).eq("customer_id", user.id).single();
      if (refreshError) throw refreshError;
      return NextResponse.json({ success: true, data: { address: refreshed } }, { status: 201, headers });
    }
    return NextResponse.json({ success: true, data: { address: data } }, { status: 201, headers });
  } catch (error) {
    console.error("[api/addresses] POST failed:", error);
    return NextResponse.json({ success: false, error: "Unable to save address. Please retry." }, { status: 503, headers });
  }
}
