"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useBag } from "@/components/bag/BagContext";
import { DeliveryInfo } from "@/components/delivery/DeliveryInfo";
import { Button } from "@/components/ui/button";
import { milkProductId } from "@/lib/bag";
import { MILK_VOLUME_OPTIONS, formatInr, deliveryFeeLabel } from "@/lib/business";
import { calculateMilkDeliveryPricePaise } from "@/lib/services/pricing-service";
import {
  formatQty,
  getMilkOptionPriceInr,
  getVisibleOptions,
  isMilkOrderingAvailable,
  isOrderableMilkQuantity,
  milkTypeLabel,
  type MilkOption,
  type MilkTypeFilter,
  type MilkVendor,
} from "@/lib/milk";
import type { CanteenMilkData } from "@/lib/services/vendor-db-service";

type VendorOptionRowProps = {
  vendor: MilkVendor;
  option: MilkOption;
};

/**
 * Add-to-bag row for a VERIFIED vendor + milk type.
 * Sizes are limited to the standard 500 ml and 1 L packs with exact workbook pricing.
 */
function VendorOptionRow({ vendor, option }: VendorOptionRowProps) {
  const { addItem } = useBag();
  const [litres, setLitres] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const currentPriceInr = getMilkOptionPriceInr(option, litres);
  const selectedVariantId = litres === 0.5 ? option.variantId500ml : option.variantId1l;
  const selectedLabel = formatQty(litres);

  const handleAdd = () => {
    if (!isOrderableMilkQuantity(litres) || !vendor.orderingEnabled ||
        !selectedVariantId || currentPriceInr === null) return;
    const typeName = milkTypeLabel(option.type);
    addItem({
      key: "milk:" + vendor.id + ":" + option.type + ":" + litres,
      kind: "milk",
      productId: milkProductId(vendor.id, option.type),
      productVariantId: selectedVariantId,
      name: typeName + " (" + selectedLabel + ")",
      image: "/images/products/milk.jpg",
      detail: typeName + " · " + selectedLabel + " per delivery",
      vendorName: vendor.name,
      milkType: option.type,
      litres,
      unitPriceInr: currentPriceInr,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="db-milk-option rounded-[1.5rem] border-2 border-white bg-[#dff5fc] p-4 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{milkTypeLabel(option.type)}</h3>
        <span className="text-sm font-bold text-foreground tabular-nums">
          {currentPriceInr !== null ? formatInr(currentPriceInr) + " / " + selectedLabel : "Rate unavailable"}
        </span>
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Select milk volume for {vendor.name} {milkTypeLabel(option.type)}</span>
        <select
          value={String(litres)}
          onChange={(event) => setLitres(Number(event.target.value))}
          className="min-h-12 w-full rounded-full border-2 border-[#dff5fc] bg-white px-4 text-sm font-semibold text-[#284967] focus:border-[#528cb5] focus:outline-none"
          disabled={!vendor.orderingEnabled}
        >
          {MILK_VOLUME_OPTIONS.map((volume) => (
            <option key={volume.litres} value={String(volume.litres)}>{volume.label}</option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        {currentPriceInr !== null
          ? "Selected volume: " + selectedLabel + " · Final price: " + formatInr(currentPriceInr)
          : "Live price is unavailable for this selection."}
      </p>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!vendor.orderingEnabled || !selectedVariantId || currentPriceInr === null}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-pop transition-colors hover:bg-primary-hover active:translate-y-px active:shadow-none disabled:opacity-60"
      >
        {justAdded ? "Added to Bag" : currentPriceInr !== null
          ? "Add " + selectedLabel + " to Bag · " + formatInr(currentPriceInr)
          : "Price unavailable"}
      </button>
    </div>
  );
}

/**
 * Interactive Canteen Milk Card (Single-vendor arrangement).
 */
function CanteenMilkCard({ canteenMilkVendor }: { canteenMilkVendor: CanteenMilkData }) {
  const { addItem } = useBag();
  const [litres, setLitres] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const half = canteenMilkVendor.pricing.find((price) => price.litres === 0.5);
  const one = canteenMilkVendor.pricing.find((price) => price.litres === 1);
  const reference = litres === 0.5 ? half : one;
  const pricePaise = half && one
    ? calculateMilkDeliveryPricePaise({
        litres,
        price500mlPaise: Math.round(half.milkPriceInr * 100),
        delivery500mlPaise: Math.round(half.deliveryFeeInr * 100),
        price1lPaise: Math.round(one.milkPriceInr * 100),
        delivery1lPaise: Math.round(one.deliveryFeeInr * 100),
      })
    : null;
  const currentPriceInr = pricePaise === null ? null : pricePaise / 100;
  const selectedLabel = formatQty(litres);

  if (!reference || !canteenMilkVendor.orderable) return null;

  const handleAddCanteen = () => {
    if (!reference.productVariantId || currentPriceInr === null ||
        !isOrderableMilkQuantity(litres)) return;
    addItem({
      key: "milk:" + canteenMilkVendor.id + ":canteen:" + litres,
      kind: "milk",
      productId: milkProductId(canteenMilkVendor.id, "canteen"),
      productVariantId: reference.productVariantId,
      name: "Canteen Milk (" + selectedLabel + ")",
      image: "/images/products/milk.jpg",
      detail: "Canteen Milk · " + selectedLabel + " per delivery (delivery fee included)",
      vendorName: canteenMilkVendor.name,
      milkType: "canteen",
      litres,
      unitPriceInr: currentPriceInr,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <section aria-labelledby="canteen-milk-title"
      className="db-vendor-card mt-6 rounded-[2.5rem] border-2 border-white bg-[#ffd0ae] p-5 shadow-pop sm:p-6">
      <p className="text-xs font-semibold text-highlight-ink">Separate single-vendor arrangement</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="canteen-milk-title" className="text-xl font-bold text-card-foreground">{canteenMilkVendor.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Budget milk supply. Delivery component is included in the displayed per-delivery price.
          </p>
        </div>
        <span className="rounded-full bg-success-surface px-3 py-1 text-xs font-semibold text-success">Confirmed Pricing</span>
      </div>
      <div className="mt-4 rounded-[1.5rem] border-2 border-white bg-[#dff5fc] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-foreground">Canteen Milk</h3>
          <span className="text-sm font-bold text-foreground tabular-nums">
            {currentPriceInr !== null ? formatInr(currentPriceInr) + " / delivery" : "Rate unavailable"}
          </span>
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Select canteen milk volume</span>
          <select value={String(litres)} onChange={(event) => setLitres(Number(event.target.value))}
            className="min-h-12 w-full rounded-full border-2 border-white bg-white px-4 text-sm font-semibold text-[#284967] focus:border-[#528cb5] focus:outline-none">
            {MILK_VOLUME_OPTIONS.map((volume) => (
              <option key={volume.litres} value={String(volume.litres)}>{volume.label}</option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          {currentPriceInr !== null ? "Selected volume: " + selectedLabel + " · Final price: " + formatInr(currentPriceInr) : "Live price unavailable."}
        </p>
        <button type="button" onClick={handleAddCanteen}
          disabled={!reference.productVariantId || currentPriceInr === null}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-pop disabled:opacity-60">
          {justAdded ? "Added to Bag" : currentPriceInr !== null
            ? "Add " + selectedLabel + " to Bag · " + formatInr(currentPriceInr)
            : "Price unavailable"}
        </button>
      </div>
    </section>
  );
}

export function MilkVendorSelector() {
  const [filter, setFilter] = useState<MilkTypeFilter>("all");
  const [milkVendors, setMilkVendors] = useState<readonly MilkVendor[]>([]);
  const [canteenVendor, setCanteenVendor] = useState<CanteenMilkData | null>(null);
  const [catalogueStatus, setCatalogueStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [checkoutNoticeOpen, setCheckoutNoticeOpen] = useState(false);
  const { items, incrementItem, decrementItem, removeItem, openBag } = useBag();
  const orderingAvailable = isMilkOrderingAvailable(milkVendors);
  const availableVendorCount = milkVendors.filter((vendor) => vendor.orderingEnabled).length;
  const pendingVendorCount = milkVendors.length - availableVendorCount;

  useEffect(() => {
    let active = true;
    async function loadMilkCatalogue() {
      setCatalogueStatus("loading");
      try {
        const [vendorsResponse, canteenResponse] = await Promise.all([
          fetch("/api/vendors/milk", { cache: "no-store" }),
          fetch("/api/canteen", { cache: "no-store" }),
        ]);
        const [vendorsPayload, canteenPayload] = await Promise.all([
          vendorsResponse.json() as Promise<{ success: boolean; data?: { vendors: MilkVendor[] }; error?: string }>,
          canteenResponse.json() as Promise<{ success: boolean; data?: { vendor: CanteenMilkData }; error?: string }>,
        ]);
        if (!vendorsResponse.ok || !canteenResponse.ok || !vendorsPayload.success || !canteenPayload.success || !vendorsPayload.data || !canteenPayload.data) {
          throw new Error(vendorsPayload.error || canteenPayload.error || "Milk catalogue is unavailable.");
        }
        if (!active) return;
        setMilkVendors(vendorsPayload.data.vendors);
        setCanteenVendor(canteenPayload.data.vendor);
        setCatalogueStatus("ready");
      } catch {
        if (active) setCatalogueStatus("error");
      }
    }
    void loadMilkCatalogue();
    return () => { active = false; };
  }, [reloadToken]);

  const milkItems = useMemo(
    () => items.filter((item) => item.kind === "milk"),
    [items],
  );

  const totalLitres = useMemo(
    () =>
      milkItems.reduce(
        (sum, item) => sum + (item.litres ?? 0) * item.quantity,
        0,
      ),
    [milkItems],
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            role="group"
            aria-label="Filter milk vendors by milk type"
            className="inline-flex flex-wrap items-center gap-1.5 rounded-card border border-border bg-card p-1.5"
          >
            {(["all", "cow", "buffalo"] as const).map((type) => {
              const active = filter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(type)}
                  aria-pressed={active}
                  className={`min-h-10 shrink-0 rounded-control px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {type === "all" ? "All Milk" : milkTypeLabel(type)}
                </button>
              );
            })}
          </div>

          <span className="rounded-full bg-success-surface px-3 py-1 text-xs font-semibold text-success">
            {availableVendorCount} vendors available{pendingVendorCount > 0 ? ` · ${pendingVendorCount} awaiting rates` : ""}
          </span>
        </div>

        {catalogueStatus === "loading" ? (
          <p role="status" className="mt-6 rounded-control border border-border bg-card p-4 text-sm text-muted-foreground">Loading live milk vendors and prices…</p>
        ) : null}
        {catalogueStatus === "error" ? (
          <div role="alert" className="mt-6 rounded-control border border-border bg-card p-4 text-sm text-foreground">
            <p>Milk pricing is temporarily unavailable. Please try again.</p>
            <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Retry</button>
          </div>
        ) : null}
        {catalogueStatus === "ready" ? (
          <>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {milkVendors.map((vendor) => {
                const visibleOptions = getVisibleOptions(vendor, filter);
                const pending = vendor.mappingStatus === "pending-verification";
                return (
                  <section key={vendor.id} aria-labelledby={`vendor-${vendor.id}`} className="db-vendor-card flex flex-col rounded-[2.5rem] border-2 border-white bg-[#dff5fc] p-5 shadow-pop sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-highlight-ink">Approved Dairybuy Vendor</p>
                        <h2 id={`vendor-${vendor.id}`} className="mt-1 text-xl font-bold text-card-foreground">{vendor.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{vendor.summary}</p>
                      </div>
                      {vendor.orderingEnabled ? (
                        <span className="shrink-0 rounded-full bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-success">Available</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Rates Pending</span>
                      )}
                    </div>
                    <div className="mt-5 grid gap-3">
                      {pending ? (
                        <>
                          <p role="note" className="rounded-control border border-border bg-white/80 p-4 text-sm leading-relaxed text-[#526b80]">{vendor.pendingReason || "Rates are awaiting owner confirmation."} This vendor will become orderable as soon as its approved rates are added.</p>
                          <button type="button" disabled aria-disabled="true" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground opacity-80">Unavailable for now</button>
                        </>
                      ) : null}
                      {!pending ? visibleOptions.map((option) => <VendorOptionRow key={option.type} vendor={vendor} option={option} />) : null}
                    </div>
                  </section>
                );
              })}
            </div>
            {canteenVendor?.orderable ? <CanteenMilkCard canteenMilkVendor={canteenVendor} /> : null}
          </>
        ) : null}
      </div>

      <aside
        aria-label="Selected milk summary"
        className="db-milk-summary rounded-[2.5rem] border-2 border-white bg-[#ffd0ae] p-5 shadow-pop sm:p-6 lg:sticky lg:top-24"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-card-foreground">
            <ShoppingBag className="h-5 w-5 text-highlight-ink" aria-hidden="true" />
            <span>Milk Selection</span>
          </h2>
          {milkItems.length > 0 ? (
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {formatQty(Number(totalLitres.toFixed(2)))} total
            </span>
          ) : null}
        </div>

        {milkItems.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {orderingAvailable
              ? "No milk added yet. Pick a vendor, choose cow or buffalo milk, and select 500 ml to 10 L."
              : "Milk selection is temporarily unavailable pending vendor confirmation, so nothing has been added."}
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {milkItems.map((item) => (
                <li
                  key={item.key}
                  className="rounded-control border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-highlight-ink">
                        {item.vendorName}
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {item.milkType ? milkTypeLabel(item.milkType) : item.name} ·{" "}
                        {item.litres ? formatQty(item.litres) : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {item.unitPriceInr !== null
                        ? `₹${item.unitPriceInr * item.quantity}`
                        : "Rate confirmed at checkout"}
                    </span>
                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => decrementItem(item.key)}
                        aria-label={`Decrease packs of ${item.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-foreground hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-5 text-center text-xs font-bold text-foreground tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => incrementItem(item.key)}
                        aria-label={`Increase packs of ${item.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-foreground hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Total milk volume</dt>
                <dd className="font-semibold text-foreground tabular-nums">
                  {formatQty(Number(totalLitres.toFixed(2)))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Delivery fee</dt>
                <dd className="font-semibold text-foreground">
                  {deliveryFeeLabel()}
                </dd>
              </div>
            </dl>

            {checkoutNoticeOpen ? (
              <div
                role="status"
                className="mt-4 rounded-control border border-border bg-muted p-3 text-xs leading-relaxed text-foreground"
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  <Info className="h-4 w-4 shrink-0 text-highlight-ink" aria-hidden="true" />
                  Ordering arrives in Phase 5
                </p>
                <p className="mt-1 text-muted-foreground">
                  Phase 4 establishes complete database schemas, confirmed prices, and RLS security. Live payment gateway and order placement will activate in Phase 5.
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2.5">
              <Button
                variant="primary"
                onClick={() => setCheckoutNoticeOpen(true)}
                className="w-full"
              >
                Proceed to Order
              </Button>
              <Button variant="secondary" onClick={openBag} className="w-full">
                Open Full Selection Bag
              </Button>
            </div>
          </>
        )}

        <DeliveryInfo className="mt-4" />
      </aside>
    </div>
  );
}
