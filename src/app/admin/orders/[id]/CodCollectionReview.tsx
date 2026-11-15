"use client";

import { useActionState } from "react";
import {
  reviewCodCashCollectionAction,
  type ReviewCodCollectionState,
} from "./cod-collection-actions";

export type CodCollectionReviewRecord = {
  collection_id: string;
  order_id: string;
  amount_collected_paise: number;
  collection_status: string;
  collected_by_staff_id: string;
  collected_at: string;
  receipt_reference: string | null;
  collection_notes: string | null;
  verified_by_manager_id: string | null;
  verified_at: string | null;
  rejected_by_manager_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
};

const INITIAL_STATE: ReviewCodCollectionState = { success: false, message: "" };

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function timestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function CodCollectionReview({
  orderId,
  orderTotalPaise,
  collection,
}: {
  orderId: string;
  orderTotalPaise: number;
  collection: CodCollectionReviewRecord | null;
}) {
  const [state, formAction, pending] = useActionState(
    reviewCodCashCollectionAction,
    INITIAL_STATE,
  );

  const exactAmount = collection?.amount_collected_paise === orderTotalPaise;
  const canVerify = collection?.collection_status === "collected" && exactAmount;

  return (
    <section className="mt-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">COD cash verification</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner/admin review · Payment settles only after exact cash verification
          </p>
        </div>
        {collection ? (
          <span className="rounded-full bg-[#f3f7f8] px-3 py-1 text-xs font-bold capitalize">
            {statusLabel(collection.collection_status)}
          </span>
        ) : null}
      </div>

      {!collection ? (
        <p className="mt-4 rounded-xl bg-[#f3f7f8] p-3 text-sm text-muted-foreground">
          No COD cash collection has been recorded for this order yet.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Cash recorded</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{money(collection.amount_collected_paise)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Authoritative order total</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{money(orderTotalPaise)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Collected at</dt>
              <dd className="mt-1 font-semibold">{timestamp(collection.collected_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Collector user ID</dt>
              <dd className="mt-1 break-all font-mono text-xs">{collection.collected_by_staff_id}</dd>
            </div>
          </dl>

          {collection.receipt_reference ? (
            <p className="mt-3 text-sm"><span className="text-muted-foreground">Receipt reference:</span> {collection.receipt_reference}</p>
          ) : null}
          {collection.collection_notes ? (
            <p className="mt-2 rounded-xl bg-[#f8fbfc] p-3 text-sm">{collection.collection_notes}</p>
          ) : null}

          {collection.collection_status === "verified" ? (
            <div className="mt-4 rounded-xl bg-[#eaf7ef] p-3 text-sm text-[#17643b]">
              <p className="font-bold">Verified and captured</p>
              <p className="mt-1">Reviewed at {timestamp(collection.verified_at)} · Reviewer {collection.verified_by_manager_id ?? "—"}</p>
            </div>
          ) : collection.collection_status === "rejected" ? (
            <div className="mt-4 rounded-xl bg-[#fff3f1] p-3 text-sm text-[#9f3028]">
              <p className="font-bold">Collection rejected · Payment remains pending</p>
              <p className="mt-1">{collection.rejection_reason}</p>
              <p className="mt-1 text-xs">Rejected at {timestamp(collection.rejected_at)} · Reviewer {collection.rejected_by_manager_id ?? "—"}</p>
            </div>
          ) : collection.collection_status === "disputed" ? (
            <p className="mt-4 rounded-xl bg-[#fff8e7] p-3 text-sm text-[#805b18]">
              Amount mismatch: this record cannot be verified in Phase 4.5.2. Reject it with a reason or leave it for Phase 4.5.3 discrepancy resolution.
            </p>
          ) : null}

          {collection.collection_status === "collected" || collection.collection_status === "disputed" ? (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {collection.collection_status === "collected" && !exactAmount ? (
                <p role="alert" className="text-sm text-[#9f3028]">
                  Amount does not match the order total. Verification is disabled.
                </p>
              ) : null}

              {canVerify ? (
                <form action={formAction} className="grid gap-2">
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="decision" value="verify" />
                  <label className="grid gap-1 text-xs font-semibold">
                    Verification note (optional)
                    <textarea name="note" maxLength={500} rows={2} className="min-h-16 rounded-xl border border-border px-3 py-2 text-sm font-normal" placeholder="Cash counted and matched with the order total" />
                  </label>
                  <button type="submit" disabled={pending} onClick={(event) => {
                    if (!window.confirm("Verify the cash amount and mark the COD payment as captured?")) event.preventDefault();
                  }} className="min-h-11 rounded-full bg-[#17643b] px-5 text-sm font-bold text-white disabled:opacity-60">
                    {pending ? "Saving review…" : "Verify cash and capture payment"}
                  </button>
                </form>
              ) : null}

              <form action={formAction} className="grid gap-2">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="decision" value="reject" />
                <label className="grid gap-1 text-xs font-semibold">
                  Rejection reason (required, 5–500 characters)
                  <textarea name="note" minLength={5} maxLength={500} required rows={2} className="min-h-16 rounded-xl border border-border px-3 py-2 text-sm font-normal" placeholder="Explain why this cash record is being rejected" />
                </label>
                <button type="submit" disabled={pending} onClick={(event) => {
                  if (!window.confirm("Reject this COD cash record? Payment will remain pending.")) event.preventDefault();
                }} className="min-h-11 justify-self-start rounded-full border border-[#c94b42] px-5 text-sm font-bold text-[#9f3028] disabled:opacity-60">
                  {pending ? "Saving review…" : "Reject collection"}
                </button>
              </form>
            </div>
          ) : null}
        </>
      )}

      {state.message ? (
        <p role={state.success ? "status" : "alert"} aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm ${state.success ? "bg-[#eaf7ef] text-[#17643b]" : "bg-[#fff3f1] text-[#9f3028]"}`}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
