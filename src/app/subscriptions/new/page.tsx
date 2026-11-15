import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/brand/Container";
import { SubscriptionQuoteBuilder } from "@/components/subscriptions/SubscriptionQuoteBuilder";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/subscriptions/new");
  return <main className="db-page py-(--section-y)"><Container className="max-w-3xl">
    <div className="mb-7"><Link href="/subscriptions" className="text-sm font-semibold text-highlight-ink underline">← My subscriptions</Link><p className="mt-5 text-sm font-semibold text-highlight-ink">Daily milk, delivered</p><h1 className="mt-2 text-3xl font-bold">Build your milk plan</h1><p className="mt-2 text-sm text-muted-foreground">Choose a 7-day or 30-day plan, approved milk vendor, quantity and delivery schedule. Prices are calculated by Dairybuy's database.</p></div>
    <SubscriptionQuoteBuilder />
  </Container></main>;
}
