import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { correctCashHandoverAction, reviewCashHandoverAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { from?: string | string[]; to?: string | string[]; area?: string | string[]; staff?: string | string[] };
type ReportRow = {
  order_id: string; order_number: string; business_date: string; service_area_id: string; service_area_name: string;
  delivery_slot: string; staff_id: string | null; staff_name: string; collection_id: string | null; collection_status: string;
  amount_collected_paise: number; order_total_paise: number; variance_paise: number; collected_at: string | null;
  handover_id: string | null; handover_number: string | null; handover_status: string | null;
  handover_expected_paise: number | null; handover_received_paise: number | null;
};
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
const iso = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const validDate = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export default async function AdminCodFinancePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const fromDate = validDate(iso(query.from)) ?? today;
  const toDate = validDate(iso(query.to)) ?? today;
  const areaId = iso(query.area) ?? "";
  const staffId = iso(query.staff) ?? "";
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/finance/cod");
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) redirect("/account");

  const [reportResult, areaResult] = await Promise.all([
    supabase.rpc("get_admin_cod_financial_report", {
      p_from_date: fromDate, p_to_date: toDate, p_service_area_id: areaId || null, p_staff_id: staffId || null,
    }),
    supabase.from("service_areas").select("id,name").eq("is_active", true).order("name"),
  ]);
  if (reportResult.error) throw new Error("Unable to load COD financial report.");
  if (areaResult.error) throw new Error("Unable to load service-area filters.");
  const rows = (reportResult.data ?? []) as ReportRow[];
  const sum = (values: ReportRow[]) => values.reduce((total, row) => total + row.amount_collected_paise, 0);
  const verified = rows.filter((row) => row.collection_status === "verified");
  const disputed = rows.filter((row) => ["disputed", "rejected"].includes(row.collection_status));
  const unhanded = rows.filter((row) => row.collection_id && !row.handover_id);
  const missingCollections = rows.filter((row) => !row.collection_id);
  const batches = [...new Map(rows.filter((row) => row.handover_id).map((row) => [row.handover_id!, row])).values()];

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p><h1 className="mt-2 text-3xl font-bold">COD financial reconciliation</h1><p className="mt-2 text-sm text-muted-foreground">One-time COD only · Kolkata delivery date · Owner/admin access</p></div>
          <div className="flex gap-4 text-sm font-semibold"><Link href="/admin/orders" className="text-highlight-ink underline">Orders</Link><Link href="/account" className="text-highlight-ink underline">Account</Link></div>
        </div>
        <form method="get" className="mb-5 grid gap-3 rounded-3xl border-2 border-white bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold">From date<input type="date" name="from" defaultValue={fromDate} className="min-h-11 rounded-xl border border-border px-3 text-sm"/></label>
          <label className="grid gap-1 text-xs font-semibold">To date<input type="date" name="to" defaultValue={toDate} className="min-h-11 rounded-xl border border-border px-3 text-sm"/></label>
          <label className="grid gap-1 text-xs font-semibold">Service area<select name="area" defaultValue={areaId} className="min-h-11 rounded-xl border border-border px-3 text-sm"><option value="">All areas</option>{(areaResult.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold">Delivery staff<select name="staff" defaultValue={staffId} className="min-h-11 rounded-xl border border-border px-3 text-sm"><option value="">All staff</option>{[...new Map(rows.filter((r) => r.staff_id).map((r) => [r.staff_id!, r.staff_name])).entries()].map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <div className="flex items-end gap-2"><button className="min-h-11 flex-1 rounded-full bg-[#573b75] px-4 text-sm font-bold text-white">Apply</button><Link href="/admin/finance/cod" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold">Reset</Link></div>
        </form>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{rows.length} collection records · {fromDate} to {toDate}</p><a href={`/admin/finance/cod/export?from=${fromDate}&to=${toDate}&area=${areaId}&staff=${staffId}`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Export CSV</a></div>
        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Cash recorded</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(sum(rows))}</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Verified / captured</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(sum(verified))}</p><p className="text-xs text-muted-foreground">{verified.length} orders</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Disputed / rejected</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(sum(disputed))}</p><p className="text-xs text-muted-foreground">{disputed.length} orders</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Not yet handed over</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(sum(unhanded))}</p><p className="text-xs text-muted-foreground">{unhanded.length} collections</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Delivered, collection not recorded</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(missingCollections.reduce((n,r) => n + r.order_total_paise, 0))}</p><p className="text-xs text-muted-foreground">{missingCollections.length} orders awaiting collection record</p></div>
        </section>
        <section className="mb-5 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4"><h2 className="font-bold">Cash handover batches</h2><p className="mt-1 text-xs text-muted-foreground">Acceptance reconciles physical cash with recorded collections; it does not capture COD payments.</p></div>
          {batches.length ? <ul className="divide-y divide-border">{batches.map((row) => <li key={row.handover_id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
            <div><p className="font-bold">{row.handover_number}</p><p className="text-xs text-muted-foreground">{row.staff_name} · {row.business_date} · {row.service_area_name}</p></div>
            <div className="text-sm"><p>Expected: <b>{money(row.handover_expected_paise ?? 0)}</b></p><p>Received: <b>{money(row.handover_received_paise ?? 0)}</b></p></div>
            <p className="text-sm capitalize">Status: {row.handover_status}</p>
            {row.handover_status === "submitted" ? <div className="flex flex-wrap gap-2"><form action={reviewCashHandoverAction}><input type="hidden" name="handoverId" value={row.handover_id!}/><input type="hidden" name="decision" value="accept"/><button className="rounded-full bg-[#17643b] px-4 py-2 text-xs font-bold text-white">Accept exact cash</button></form><form action={reviewCashHandoverAction} className="flex gap-2"><input type="hidden" name="handoverId" value={row.handover_id!}/><input type="hidden" name="decision" value="dispute"/><input name="note" required minLength={5} maxLength={500} placeholder="Dispute reason" className="w-36 rounded-xl border border-border px-2 text-xs"/><button className="rounded-full border border-[#c94b42] px-3 py-2 text-xs font-bold text-[#9f3028]">Dispute</button></form></div>
            : row.handover_status === "disputed" ? <form action={correctCashHandoverAction} className="grid gap-2 sm:grid-cols-2"><input type="hidden" name="handoverId" value={row.handover_id!}/><input type="number" name="correctedReceivedRupees" min="0.01" step="0.01" required placeholder="Recounted amount (₹)" className="rounded-xl border border-border px-3 py-2 text-xs"/><input name="reason" minLength={5} maxLength={500} required placeholder="Correction reason" className="rounded-xl border border-border px-3 py-2 text-xs"/><input name="evidenceReference" maxLength={200} placeholder="Evidence reference" className="rounded-xl border border-border px-3 py-2 text-xs"/><button className="rounded-full border border-border px-3 py-2 text-xs font-bold">Record recount</button></form> : null}
          </li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">No cash handover batches in this date range.</p>}
        </section>
        <section className="overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4"><h2 className="font-bold">Collection ledger</h2><p className="mt-1 text-xs text-muted-foreground">Variance = cash recorded minus authoritative order total. No refunds or write-offs are inferred.</p></div>
          {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8fbfc] text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date / order</th><th className="px-4 py-3">Staff / area</th><th className="px-4 py-3">Cash / order</th><th className="px-4 py-3">Variance</th><th className="px-4 py-3">Collection</th><th className="px-4 py-3">Handover</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.collection_id ?? row.order_id}><td className="px-4 py-3"><p className="font-semibold">{row.business_date}</p><Link href={`/admin/orders/${row.order_id}`} className="text-highlight-ink underline">{row.order_number}</Link></td><td className="px-4 py-3">{row.staff_name}<p className="text-xs text-muted-foreground">{row.service_area_name} · {row.delivery_slot}</p></td><td className="px-4 py-3 tabular-nums">{money(row.amount_collected_paise)}<p className="text-xs text-muted-foreground">Order {money(row.order_total_paise)}</p></td><td className="px-4 py-3 tabular-nums">{money(row.variance_paise)}</td><td className="px-4 py-3 capitalize">{row.collection_status}</td><td className="px-4 py-3">{row.handover_number ?? (row.collection_id ? "Not handed over" : "No collection record")}<p className="text-xs capitalize text-muted-foreground">{row.handover_status ?? "pending"}</p></td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-muted-foreground">No COD cash collections match these filters.</p>}
        </section>
      </Container>
    </main>
  );
}
