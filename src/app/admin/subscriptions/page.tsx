import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { SubscriptionOperations } from "@/components/subscriptions/SubscriptionOperations";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CodCollection = {
  collection_id: string; order_id: string; amount_collected_paise: number;
  collection_status: string; collected_at: string; receipt_reference: string | null;
  verified_at: string | null; rejected_at: string | null; rejection_reason: string | null;
};
type DeliveryRow = {
  id: string; subscription_id: string; delivery_date: string; status: string;
  delivery_notes: string | null; assigned_staff_id: string | null; order_id: string | null;
  codCollection: CodCollection | null;
};

export default async function AdminSubscriptionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/subscriptions");
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((row) => isAdminOrOwner(row.role))) redirect("/account");

  const { data, error } = await supabase.from("subscription_deliveries")
    .select("id,subscription_id,delivery_date,status,delivery_notes,assigned_staff_id,order_id")
    .order("delivery_date", { ascending: true }).limit(100);
  if (error) throw new Error("Unable to load subscription operations.");

  const deliveries = (data ?? []) as Omit<DeliveryRow, "codCollection">[];
  const collectionRows = await Promise.all(deliveries
    .filter((delivery) => delivery.status === "delivered" && delivery.order_id)
    .map(async (delivery) => {
      const { data: collection, error: collectionError } = await supabase.rpc("get_admin_cod_collection" as never, {
        p_order_id: delivery.order_id,
      } as never);
      if (collectionError) throw new Error("Unable to load subscription COD collection status.");
      const row = Array.isArray(collection) ? collection[0] as CodCollection | undefined : undefined;
      return [delivery.id, row ?? null] as const;
    }));
  const collections = new Map(collectionRows);
  const rows: DeliveryRow[] = deliveries.map((delivery) => ({
    ...delivery, codCollection: collections.get(delivery.id) ?? null,
  }));

  return <main className="db-page py-(--section-y)"><Container className="max-w-5xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p><h1 className="mt-2 text-3xl font-bold">Subscription deliveries</h1><p className="mt-2 text-sm text-muted-foreground">Owner/admin control · Dispatch, mark delivered, record cash and resolve exceptions.</p></div>
      <div className="flex gap-4"><Link href="/admin/orders" className="text-sm font-semibold text-highlight-ink underline">One-time orders</Link><Link href="/admin/finance/cod" className="text-sm font-semibold text-highlight-ink underline">COD finance</Link><Link href="/account" className="text-sm font-semibold text-highlight-ink underline">Account</Link></div>
    </div>
    <div className="mb-6 rounded-2xl border border-border bg-white p-4 text-sm">
      <strong>Per-delivery COD.</strong> There is no delivery-agent interface. Owner/admin can dispatch or mark a delivery complete; customers can confirm receipt after dispatch. Record and verify cash separately for each delivered day.
    </div>
    <SubscriptionOperations deliveries={rows} />
  </Container></main>;
}
