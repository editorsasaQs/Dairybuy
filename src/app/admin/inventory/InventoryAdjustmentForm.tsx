"use client";

import { useActionState, useState } from "react";
import { adjustInventoryAction, type InventoryActionState } from "./actions";

type Option = { id: string; label: string; available: number; reserved: number };
const initialState: InventoryActionState = { success: false, message: "" };

export function InventoryAdjustmentForm({ inventory, idempotencyKey }: { inventory: Option[]; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(adjustInventoryAction, initialState);
  const [type, setType] = useState("spoilage");
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="grid gap-1 text-xs font-semibold">Inventory SKU / area
        <select name="inventoryId" required defaultValue="" className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="" disabled>Select inventory row</option>{inventory.map((row) => <option key={row.id} value={row.id}>{row.label} · On hand {row.available} · Reserved {row.reserved}</option>)}</select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">Adjustment type
        <select name="adjustmentType" value={type} onChange={(event) => setType(event.target.value)} className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm">
          <option value="spoilage">Spoilage (reduce stock)</option><option value="damage">Damage (reduce stock)</option><option value="stocktake_adjustment">Stocktake difference (+/-)</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">{type === "stocktake_adjustment" ? "Quantity difference (+/- units)" : "Units to remove"}
        <input name="quantity" type="number" step="1" required min={type === "stocktake_adjustment" ? undefined : 1} className="min-h-11 rounded-xl border border-border px-3 text-sm" placeholder={type === "stocktake_adjustment" ? "e.g. -2 or 5" : "e.g. 2"} />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Reason (5–500 characters)
        <textarea name="reason" required minLength={5} maxLength={500} rows={3} className="rounded-xl border border-border px-3 py-2 text-sm font-normal" placeholder="Explain the physical count or loss" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Evidence reference <span className="font-normal text-muted-foreground">Optional · max 200 characters</span>
        <input name="evidenceReference" maxLength={200} className="min-h-11 rounded-xl border border-border px-3 text-sm" placeholder="Photo, report or stocktake sheet reference" />
      </label>
      {state.message ? <p role="alert" className="rounded-xl bg-[#fff3f1] p-3 text-sm text-[#9f3028]">{state.message}</p> : null}
      <button type="submit" disabled={pending || inventory.length === 0} className="min-h-12 rounded-full border border-[#573b75] px-5 text-sm font-bold text-[#573b75] disabled:opacity-50">{pending ? "Saving adjustment…" : "Record stock adjustment"}</button>
      <p className="text-xs text-muted-foreground">Adjustments cannot reduce on-hand stock below reserved stock. Each action requires a reason and is permanently recorded.</p>
    </form>
  );
}
