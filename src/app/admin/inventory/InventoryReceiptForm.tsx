"use client";

import { useActionState, useState } from "react";
import { receiveInventoryAction, type InventoryActionState } from "./actions";

type Option = { id: string; label: string };
type Line = { key: number; variantId: string; quantity: string; unitCostRupees: string };
const initialState: InventoryActionState = { success: false, message: "" };

export function InventoryReceiptForm({
  vendors, areas, variants, idempotencyKey,
}: {
  vendors: Option[]; areas: Option[]; variants: Option[]; idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(receiveInventoryAction, initialState);
  const [lines, setLines] = useState<Line[]>([{ key: 1, variantId: "", quantity: "1", unitCostRupees: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const totalUnits = lines.reduce((sum, line) => sum + (Number(line.quantity) > 0 ? Number(line.quantity) : 0), 0);
  const totalRupees = lines.reduce((sum, line) => sum + (Number(line.quantity) > 0 && Number(line.unitCostRupees) >= 0 ? Number(line.quantity) * Number(line.unitCostRupees || 0) : 0), 0);

  function update(key: number, field: keyof Omit<Line, "key">, value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">Approved vendor
          <select name="vendorId" required defaultValue="" className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="" disabled>Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.label}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Service area
          <select name="areaId" required defaultValue="" className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="" disabled>Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Vendor invoice / reference <span className="font-normal text-muted-foreground">Optional · max 120 characters</span>
          <input name="vendorReference" maxLength={120} className="min-h-11 rounded-xl border border-border px-3 text-sm" placeholder="Invoice number" />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Receipt notes <span className="font-normal text-muted-foreground">Optional</span>
          <input name="notes" maxLength={500} className="min-h-11 rounded-xl border border-border px-3 text-sm" placeholder="Quality, batch or delivery notes" />
        </label>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-bold">Received SKU lines</h3><button type="button" disabled={lines.length >= 100} onClick={() => { setLines((current) => [...current, { key: nextKey, variantId: "", quantity: "1", unitCostRupees: "" }]); setNextKey((key) => key + 1); }} className="rounded-full border border-border px-3 py-2 text-xs font-bold disabled:opacity-40">+ Add SKU</button></div>
        <div className="grid gap-3">
          {lines.map((line, index) => (
            <div key={line.key} className="grid gap-2 rounded-2xl bg-[#f8fbfc] p-3 sm:grid-cols-[minmax(0,2fr)_0.7fr_1fr_auto] sm:items-end">
              <label className="grid min-w-0 gap-1 text-xs font-semibold">Product / SKU
                <select name="variantId" required value={line.variantId} onChange={(event) => update(line.key, "variantId", event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-border bg-white px-2 text-sm"><option value="" disabled>Select SKU</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select>
              </label>
              <label className="grid gap-1 text-xs font-semibold">Quantity
                <input name="quantity" type="number" min="1" step="1" required value={line.quantity} onChange={(event) => update(line.key, "quantity", event.target.value)} className="min-h-11 w-full rounded-xl border border-border px-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Unit cost (₹)
                <input name="unitCostRupees" type="number" min="0" step="0.01" required value={line.unitCostRupees} onChange={(event) => update(line.key, "unitCostRupees", event.target.value)} className="min-h-11 w-full rounded-xl border border-border px-2 text-sm" placeholder="0.00" />
              </label>
              <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} aria-label={`Remove SKU line ${index + 1}`} className="min-h-11 rounded-xl border border-border px-3 text-sm font-bold disabled:opacity-30">Remove</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f3f7f8] p-3 text-sm"><span className="text-muted-foreground">{totalUnits} units across {lines.length} SKU lines</span><strong>Estimated receipt cost: ₹{totalRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
      {state.message ? <p role="alert" className="rounded-xl bg-[#fff3f1] p-3 text-sm text-[#9f3028]">{state.message}</p> : null}
      <button type="submit" disabled={pending || variants.length === 0 || vendors.length === 0 || areas.length === 0} className="min-h-12 rounded-full bg-[#573b75] px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Recording receipt…" : "Record stock receipt"}</button>
      <p className="text-xs text-muted-foreground">Submitting a receipt adds physical stock and writes an immutable movement record. Duplicate submissions are safely replayed using the receipt key.</p>
    </form>
  );
}
