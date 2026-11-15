import { NextResponse } from "next/server";
import { parseAddressInput, resolveServiceAreaId } from "@/lib/services/customer-address-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ id: string }> };

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function PATCH(request: Request, context: Context) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Address service is unavailable." }, { status: 503, headers });
  try {
    const { id } = await context.params;
    const input = parseAddressInput(await request.json());
    if (!input) return NextResponse.json({ success: false, error: "Invalid address details." }, { status: 400, headers });
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const serviceAreaId = await resolveServiceAreaId(supabase, input.pincode);
    if (!serviceAreaId) return NextResponse.json({ success: false, error: "This pincode is outside Dairybuy's active delivery area." }, { status: 422, headers });
    const { data, error } = await supabase.from("customer_addresses").update({
      address_type: input.addressType, recipient_name: input.recipientName, phone: input.phone,
      address_line1: input.addressLine1, address_line2: input.addressLine2, landmark: input.landmark,
      city: input.city, state: input.state, pincode: input.pincode, service_area_id: serviceAreaId,
    }).eq("id", id).eq("customer_id", user.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: "Address not found." }, { status: 404, headers });
    return NextResponse.json({ success: true, data: { address: data } }, { headers });
  } catch (error) {
    console.error("[api/addresses] PATCH failed:", error);
    return NextResponse.json({ success: false, error: "Unable to update address." }, { status: 503, headers });
  }
}

export async function DELETE(_request: Request, context: Context) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Address service is unavailable." }, { status: 503, headers });
  try {
    const { id } = await context.params;
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const { data, error } = await supabase.from("customer_addresses").delete()
      .eq("id", id).eq("customer_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: "Address not found." }, { status: 404, headers });
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error("[api/addresses] DELETE failed:", error);
    return NextResponse.json({ success: false, error: "Unable to delete address." }, { status: 503, headers });
  }
}
