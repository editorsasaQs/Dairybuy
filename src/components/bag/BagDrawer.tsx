"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useBag } from "@/components/bag/BagContext";
import { DeliveryInfo } from "@/components/delivery/DeliveryInfo";
import { buttonClasses } from "@/components/ui/button";
import { deliveryFeeLabel } from "@/lib/business";

export function BagDrawer() {
  const {
    items,
    totalCount,
    isOpen,
    closeBag,
    incrementItem,
    decrementItem,
    removeItem,
    clearBag,
  } = useBag();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeBag();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeBag]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-plum/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bag-drawer-title"
      onClick={closeBag}
    >
      <div
        className="db-bag-drawer flex h-full w-full max-w-md flex-col border-l-[6px] border-[#ffd329] bg-[#fffdf7] p-6 shadow-soft sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 id="bag-drawer-title" className="text-2xl font-bold text-foreground">
              Selection Bag
            </h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {totalCount === 0
                ? "No items selected yet"
                : `${totalCount} ${totalCount === 1 ? "item" : "items"} in your bag`}
            </p>
          </div>
          <button
            type="button"
            onClick={closeBag}
            aria-label="Close selection bag"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground">
              <ShoppingBag className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              Your bag is empty
            </h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Browse daily dairy staples to build your bag. Milk selection opens once vendor availability is confirmed.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/products"
                onClick={closeBag}
                className={buttonClasses("primary", "text-primary-foreground no-underline")}
              >
                Browse Catalogue
              </Link>
              <Link
                href="/milk"
                onClick={closeBag}
                className={buttonClasses("secondary", "text-secondary-foreground no-underline")}
              >
                Milk Information
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Saved automatically
              </span>
              <button
                type="button"
                onClick={() => {
                  clearBag();
                }}
                className="text-xs font-semibold text-highlight-ink underline-offset-4 hover:underline"
              >
                Clear bag
              </button>
            </div>

            <ul className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start gap-3 rounded-[1.5rem] border-2 border-white bg-[#dff5fc] p-3.5 shadow-sm"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-control bg-muted">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={128}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    {item.vendorName ? (
                      <p className="truncate text-xs font-semibold text-highlight-ink">
                        {item.vendorName}
                      </p>
                    ) : null}
                    <p className="font-heading text-base font-bold text-card-foreground">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground tabular-nums">
                      {item.unitPriceInr !== null
                        ? `₹${item.unitPriceInr * item.quantity}`
                        : "Rate confirmed at checkout"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name} from bag`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => decrementItem(item.key)}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold text-foreground tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => incrementItem(item.key)}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Item pricing</dt>
                  <dd className="text-right font-medium text-foreground">
                    Verified at checkout
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Delivery fee</dt>
                  <dd className="text-right font-semibold text-foreground tabular-nums">
                    {deliveryFeeLabel()}
                  </dd>
                </div>
              </dl>

              <DeliveryInfo showFee={false} />

              <Link
                href="/checkout"
                onClick={closeBag}
                className={buttonClasses("primary", "w-full text-primary-foreground no-underline")}
              >
                Continue to Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
