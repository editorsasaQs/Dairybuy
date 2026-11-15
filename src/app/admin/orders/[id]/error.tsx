"use client";

export default function AdminOrderDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="db-page px-4 py-12" role="alert">
      <section className="mx-auto max-w-2xl rounded-3xl border-2 border-white bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p>
        <h1 className="mt-3 text-2xl font-bold">Order details could not load</h1>
        <p className="mt-3 text-sm text-muted-foreground">The order detail page encountered an unexpected error. No order, payment, or inventory values were changed. You can retry safely.</p>
        <button type="button" onClick={() => reset()} className="mt-6 min-h-11 rounded-full bg-[#172f38] px-6 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Try again</button>
      </section>
    </main>
  );
}
