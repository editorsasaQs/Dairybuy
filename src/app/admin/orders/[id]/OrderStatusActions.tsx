"use client";

import { useActionState } from "react";
import { transitionOrderAction, type TransitionOrderState } from "./actions";
import { getNextOrderStatus } from "@/lib/services/order-fulfillment";

const INITIAL_STATE: TransitionOrderState = { success: false, message: "" };

function label(status: string) {
  return status.replaceAll("_", " ");
}

export function OrderStatusActions({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const nextStatus = getNextOrderStatus(currentStatus);
  const [state, formAction, pending] = useActionState(transitionOrderAction, INITIAL_STATE);

  if (!nextStatus) {
    return (
      <section className="mt-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
        <h2 className="font-bold">Fulfillment action</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {currentStatus === "delivered"
            ? "This order has completed fulfillment. COD collection is handled separately."
            : "No fulfillment action is available for this order status."}
        </p>
      </section>
    );
  }

  const requiresConfirmation = nextStatus === "out_for_delivery" || nextStatus === "delivered";

  return (
    <section className="mt-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
      <h2 className="font-bold">Fulfillment action</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Next permitted step: <span className="font-semibold capitalize text-foreground">{label(nextStatus)}</span>
      </p>
      <form
        action={formAction}
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          if (requiresConfirmation && !window.confirm(`Confirm moving this order to ${label(nextStatus)}?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="currentStatus" value={currentStatus} />
        <label className="grid gap-1 text-xs font-semibold">
          Internal note (optional, max 500 characters)
          <textarea
            name="note"
            maxLength={500}
            rows={2}
            placeholder="Add an operational note"
            className="min-h-20 rounded-xl border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
        <div>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-full bg-[#573b75] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Updating…" : `Move to ${label(nextStatus)}`}
          </button>
        </div>
        <p aria-live="polite" role={state.message ? "status" : undefined} className={state.message ? `text-sm ${state.success ? "text-green-700" : "text-red-700"}` : "sr-only"}>
          {state.message}
        </p>
        <p className="text-xs text-muted-foreground">
          The server rechecks your role and the current order state. Payment remains COD-pending; this action does not collect or mark cash as paid.
        </p>
      </form>
    </section>
  );
}
