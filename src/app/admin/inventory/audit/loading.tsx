import { Container } from "@/components/brand/Container";

export default function InventoryAuditLoading() {
  return (
    <main className="db-page py-(--section-y)" aria-busy="true" aria-describedby="inventory-audit-loading">
      <Container className="max-w-6xl">
        <p id="inventory-audit-loading" role="status" aria-live="polite" className="mb-4 text-sm font-semibold text-muted-foreground">Loading inventory audit…</p>
        <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
          <div className="mb-6 h-8 w-56 rounded-xl bg-[#e7eef0]" />
          <div className="mb-5 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
            <div className="h-4 w-40 rounded bg-[#e7eef0]" />
            <div className="mt-3 h-9 w-28 rounded bg-[#e7eef0]" />
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-20 rounded-2xl bg-[#f3f7f8]" />)}
            </div>
          </div>
          <div className="mb-4 flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-10 w-32 shrink-0 rounded-full bg-[#e7eef0]" />)}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="mb-3 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
              <div className="h-4 w-36 rounded bg-[#e7eef0]" />
              <div className="mt-3 h-6 w-2/3 rounded bg-[#e7eef0]" />
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, cell) => <div key={cell} className="h-12 rounded-xl bg-[#f3f7f8]" />)}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </main>
  );
}
