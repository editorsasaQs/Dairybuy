import { NextRequest, NextResponse } from "next/server";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function csv(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"','""')}"`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fromDate = params.get("from") ?? "";
  const toDate = params.get("to") ?? "";
  const area = params.get("area") ?? "";
  const staff = params.get("staff") ?? "";
  if (!DATE.test(fromDate) || !DATE.test(toDate) || (area && !UUID.test(area)) || (staff && !UUID.test(staff))) {
    return NextResponse.json({ error: "Invalid report filters." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) {
    return NextResponse.json({ error: "Owner/admin access required." }, { status: 403 });
  }
  const { data, error: reportError } = await supabase.rpc("get_admin_cod_financial_report", {
    p_from_date: fromDate, p_to_date: toDate, p_service_area_id: area || null, p_staff_id: staff || null,
  });
  if (reportError) return NextResponse.json({ error: "Unable to export COD financial report." }, { status: 400 });
  const headers = ["Delivery date","Order number","Service area","Delivery slot","Staff","Collection status",
    "Cash collected (paise)","Order total (paise)","Variance (paise)","Collected at","Handover number","Handover status",
    "Handover expected (paise)","Handover received (paise)"];
  const lines = [headers.map(csv).join(",")];
  for (const row of data ?? []) {
    lines.push([
      row.business_date,row.order_number,row.service_area_name,row.delivery_slot,row.staff_name,row.collection_status,
      row.amount_collected_paise,row.order_total_paise,row.variance_paise,row.collected_at,row.handover_number,
      row.handover_status,row.handover_expected_paise,row.handover_received_paise,
    ].map(csv).join(","));
  }
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dairybuy-cod-${fromDate}-to-${toDate}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
