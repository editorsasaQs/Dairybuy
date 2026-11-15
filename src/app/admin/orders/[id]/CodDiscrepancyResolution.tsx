import { resolveCodDiscrepancyAction } from "@/app/admin/finance/cod/actions";

export function CodDiscrepancyResolution({ orderId, amountPaise, status }: {
  orderId: string; amountPaise: number; status: string;
}) {
  if (status !== "disputed" && status !== "rejected") return null;
  return (
    <section className="mt-4 rounded-3xl border-2 border-[#f1d9a8] bg-white p-5 shadow-sm">
      <h2 className="font-bold">COD discrepancy resolution</h2>
      <p className="mt-1 text-sm text-muted-foreground">Current cash record: ₹{(amountPaise / 100).toFixed(2)} · {status}. A correction is an evidence-backed recount, not a write-off or refund. Payment remains pending unless the corrected net cash exactly matches the order total and the atomic verification succeeds.</p>
      <form action={resolveCodDiscrepancyAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="orderId" value={orderId}/>
        <label className="grid gap-1 text-xs font-semibold">Corrected net cash retained (₹)
          <input type="number" name="correctedAmountRupees" min="0.01" step="0.01" required className="min-h-11 rounded-xl border border-border px-3 text-sm"/>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Evidence reference (optional)
          <input name="evidenceReference" maxLength={200} className="min-h-11 rounded-xl border border-border px-3 text-sm" placeholder="Receipt / recount reference"/>
        </label>
        <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Reason (required, 5–500 characters)
          <textarea name="reason" minLength={5} maxLength={500} required rows={3} className="rounded-xl border border-border px-3 py-2 text-sm font-normal"/>
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-[#573b75] px-5 text-sm font-bold text-white sm:col-span-2">Record correction and re-review</button>
      </form>
    </section>
  );
}
