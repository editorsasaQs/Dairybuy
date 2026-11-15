import { Container } from "@/components/brand/Container";

export default function AdminOrderDetailLoading() {
  return (
    <main className="db-page py-(--section-y)" aria-busy="true" aria-describedby="order-detail-loading">
      <Container className="max-w-4xl">
        <p id="order-detail-loading" role="status" aria-live="polite" className="mb-4 text-sm font-semibold text-muted-foreground">Loading order details…</p>
        <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
          <div className="h-4 w-36 rounded bg-[#e7eef0]" />
          <div className="mt-5 h-9 w-48 rounded bg-[#e7eef0]" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => <div key={index} className="h-48 rounded-3xl border-2 border-white bg-white p-5 shadow-sm" />)}
          </div>
          <div className="mt-4 h-64 rounded-3xl border-2 border-white bg-white p-5 shadow-sm" />
          <div className="mt-4 h-56 rounded-3xl border-2 border-white bg-white p-5 shadow-sm" />
        </div>
      </Container>
    </main>
  );
}
