import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/brand/Container";
import { SubscriptionDashboard } from "@/components/subscriptions/SubscriptionDashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/subscriptions");
  return <main className="db-page py-(--section-y)"><Container className="max-w-4xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-semibold text-highlight-ink">Your Dairybuy account</p><h1 className="mt-2 text-3xl font-bold">Milk subscriptions</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage your daily milk plan, pause or resume deliveries, skip a future date and review your delivery calendar.</p></div>
      <Link href="/account" className="text-sm font-semibold text-highlight-ink underline">Back to account</Link>
    </div>
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Online payment setup is pending.</strong> Subscription checkout is not available yet. Existing subscriptions remain payment-gated; this page will never mark a plan paid or collect money.</div>
    <SubscriptionDashboard />
  </Container></main>;
}
