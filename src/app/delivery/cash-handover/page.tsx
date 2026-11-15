import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { Container } from "@/components/brand/Container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitStaffCashHandoverAction } from "@/app/admin/finance/cod/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Collection = {
  collection_id: string; order_id: string; order_number: string; business_date: string;
  service_area_id: string; service_area_name: string; delivery_slot_id: string; delivery_slot: string;
  amount_collected_paise: number; collection_status: string; collected_at: string;
};
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);

export default async function DeliveryCashHandoverPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/delivery/cash-handover");
  const { data, error: listError } = await supabase.rpc("get_my_unhanded_cod_collections");
  if (listError) throw new Error("Unable to load your unhanded COD collections.");
  const rows = (data ?? []) as Collection[];
  const grouped = [...new Map(rows.map((row) => [`${row.business_date}|${row.delivery_slot_id}|${row.service_area_id}`, {
    date: row.business_date, slot: row.delivery_slot, area: row.service_area_name,
    collections: rows.filter((item) => item.business_date === row.business_date && item.delivery_slot_id === row.delivery_slot_id && item.service_area_id === row.service_area_id),
  }])).values()];

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-4xl">
        <div className="mb-6"><p className="text-sm font-semibold text-highlight-ink">Dairybuy delivery operations</p><h1 className="mt-2 text-3xl font-bold">Cash handover</h1><p className="mt-2 text-sm text-muted-foreground">Select delivered COD collections from one date, slot and area, then record the cash physically handed to the office.</p></div>
        <div className="mb-5 flex flex-wrap gap-4 text-sm font-semibold"><Link href="/account" className="text-highlight-ink underline">Account</Link><Link href="/admin/finance/cod" className="text-highlight-ink underline">Financial report (owner/admin)</Link></div>
        {grouped.length ? grouped.map((group) => (
          <section key={`${group.date}|${group.slot}|${group.area}`} className="mb-5 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
            <h2 className="font-bold">{group.date} · {group.slot}</h2><p className="text-sm text-muted-foreground">{group.area}</p>
            <form action={submitStaffCashHandoverAction} className="mt-4">
              <input type="hidden" name="idempotencyKey" value={randomUUID()}/>
              <ul className="divide-y divide-border">{group.collections.map((row) => <li key={row.collection_id} className="flex items-center gap-3 py-3">
                <input type="checkbox" name="collectionIds" value={row.collection_id} defaultChecked className="size-5"/>
                <div className="min-w-0 flex-1"><Link href={`/orders/${row.order_id}`} className="font-semibold text-highlight-ink underline">{row.order_number}</Link><p className="text-xs capitalize text-muted-foreground">{row.collection_status} · {new Date(row.collected_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p></div>
                <p className="font-bold tabular-nums">{money(row.amount_collected_paise)}</p>
              </li>)}</ul>
              <label className="mt-4 grid gap-1 text-xs font-semibold">Cash physically handed over (₹)
                <input type="number" name="receivedAmountRupees" min="0" step="0.01" required className="min-h-11 rounded-xl border border-border px-3 text-sm" placeholder="Enter amount counted by office"/>
              </label>
              <p className="mt-2 text-xs text-muted-foreground">The system computes expected cash from selected collection records. Owner/admin must accept the batch; any difference is flagged for review.</p>
              <button type="submit" className="mt-4 min-h-11 rounded-full bg-[#573b75] px-5 text-sm font-bold text-white">Submit cash handover</button>
            </form>
          </section>
        )) : <section className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-bold">No cash pending handover</h2><p className="mt-2 text-sm text-muted-foreground">Delivered COD collections assigned to your account will appear here until included in a handover batch.</p></section>}
      </Container>
    </main>
  );
}
