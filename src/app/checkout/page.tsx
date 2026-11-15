import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/checkout");

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-6xl">
        <div className="mb-7">
          <p className="text-sm font-semibold text-highlight-ink">Almost there</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Complete your order</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Choose where and when you want your dairy essentials delivered. Your final price is checked securely before the order is placed.</p>
        </div>
        <CheckoutClient />
      </Container>
    </main>
  );
}
