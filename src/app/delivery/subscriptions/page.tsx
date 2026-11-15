import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/brand/Container";
import { SubscriptionOperations } from "@/components/subscriptions/SubscriptionOperations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StaffSubscriptionDeliveriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/delivery/subscriptions");
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const authorized = !roleError && (roles ?? []).some((row) => ["owner", "admin", "manager", "operations_staff"].includes(row.role));
  if (!authorized) redirect("/account");
  const { data, error } = await supabase.from("subscription_deliveries")
    .select("id,subscription_id,delivery_date,status,delivery_notes,assigned_staff_id,order_id")
    .eq("assigned_staff_id", user.id)
    .in("status", ["assigned", "out_for_delivery", "delivered"])
    .order("delivery_date", { ascending: true }).limit(100);
  if (error) throw new Error("Unable to load your assigned subscription deliveries.");
  return <main className="db-page py-(--section-y)"><Container className="max-w-4xl">
    <div className="mb-7"><p className="text-sm font-semibold text-highlight-ink">Dairybuy delivery operations</p><h1 className="mt-2 text-3xl font-bold">My subscription deliveries</h1><p className="mt-2 text-sm text-muted-foreground">Only deliveries assigned to your staff account are shown here.</p></div>
    <SubscriptionOperations deliveries={(data ?? []) as Array<{ id: string; subscription_id: string; delivery_date: string; status: string; delivery_notes: string | null; assigned_staff_id: string | null; order_id: string | null }>} staff={[]} mode="staff" />
    <p className="mt-6"><Link href="/account" className="text-sm font-semibold text-highlight-ink underline">Back to account</Link></p>
  </Container></main>;
}
