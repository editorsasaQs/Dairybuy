import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { SubscriptionOperations } from "@/components/subscriptions/SubscriptionOperations";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DeliveryRow = {
  id: string; subscription_id: string; delivery_date: string; status: string;
  delivery_notes: string | null; assigned_staff_id: string | null; order_id: string | null;
};

export default async function AdminSubscriptionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/subscriptions");
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((row) => isAdminOrOwner(row.role))) redirect("/account");

  const [deliveryResult, staffRolesResult] = await Promise.all([
    supabase.from("subscription_deliveries")
      .select("id,subscription_id,delivery_date,status,delivery_notes,assigned_staff_id,order_id")
      .order("delivery_date", { ascending: true }).limit(100),
    supabase.from("user_roles").select("user_id,role").in("role", ["owner", "admin"]),
  ]);
  if (deliveryResult.error || staffRolesResult.error) throw new Error("Unable to load subscription operations.");
  const deliveries = (deliveryResult.data ?? []) as DeliveryRow[];
  const staffIds = [...new Set((staffRolesResult.data ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = staffIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", staffIds)
    : { data: [], error: null };
  if (profilesError) throw new Error("Unable to load delivery staff.");
  const staff = (profiles ?? []).map((person) => ({
    id: person.id,
    label: person.full_name || person.email || person.id,
  }));

  return <main className="db-page py-(--section-y)"><Container className="max-w-5xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p><h1 className="mt-2 text-3xl font-bold">Subscription deliveries</h1><p className="mt-2 text-sm text-muted-foreground">Owner/admin queue · Assign, dispatch, complete or resolve failed deliveries.</p></div>
      <div className="flex gap-4"><Link href="/admin/orders" className="text-sm font-semibold text-highlight-ink underline">One-time orders</Link><Link href="/account" className="text-sm font-semibold text-highlight-ink underline">Account</Link></div>
    </div>
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Payment gate active.</strong> Only deliveries generated from a trusted verified payment can enter this queue. This page does not capture payments or create refunds.</div>
    <SubscriptionOperations deliveries={deliveries} staff={staff} />
  </Container></main>;
}
