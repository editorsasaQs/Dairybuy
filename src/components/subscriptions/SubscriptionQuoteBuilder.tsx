"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Address = { id: string; address_type: string; recipient_name: string; address_line1: string; pincode: string; is_default: boolean };
type Slot = { id: string; label: string; start_time: string; end_time: string };
type Variant = { id: string; variantName: string; unitQuantity: number; isOrderable: boolean };
type Product = { id: string; name: string; productType: string; variants: Variant[] };
type Option = { type: string; variantId500ml?: string | null; variantId1l?: string | null };
type Vendor = { id: string; name: string; orderingEnabled: boolean; verifiedOptions: Option[] };
type CanteenPrice = { productVariantId: string; litres: number };
type Quote = { plan_type: string; duration_days: number; start_date: string; end_date: string; subtotal_paise: number; discount_paise: number; total_paise: number; items: Array<{ product_name_snapshot: string; variant_name_snapshot: string; vendor_name_snapshot: string; line_total_paise: number }> };

function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100); }

export function SubscriptionQuoteBuilder() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [canteen, setCanteen] = useState<{ id: string; name: string; orderable: boolean; pricing: CanteenPrice[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addressId, setAddressId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [plan, setPlan] = useState("7_day");
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  });
  const [productId, setProductId] = useState("");
  const [milkType, setMilkType] = useState("cow");
  const [vendorId, setVendorId] = useState("");
  const [litres, setLitres] = useState("1");
  const [quantity, setQuantity] = useState("1");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    const date = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    setStartDate(date);
    void (async () => {
      try {
        const responses = await Promise.all([
          fetch("/api/addresses", { cache: "no-store" }),
          fetch("/api/delivery-slots", { cache: "no-store" }),
          fetch("/api/catalogue?category=milk", { cache: "no-store" }),
          fetch("/api/catalogue?category=canteen-milk", { cache: "no-store" }),
          fetch("/api/vendors/milk", { cache: "no-store" }),
        ]);
        const payloads = await Promise.all(responses.map((response) => response.json()));
        if (payloads.some((payload) => !payload.success)) throw new Error(payloads.find((payload) => !payload.success)?.error || "Unable to load subscription options.");
        const addressRows = payloads[0].data.addresses as Address[];
        const slotRows = payloads[1].data.slots as Slot[];
        const productRows = [...payloads[2].data.products, ...payloads[3].data.products] as Product[];
        const vendorRows = payloads[4].data.vendors as Vendor[];
        setAddresses(addressRows); setAddressId(addressRows.find((row) => row.is_default)?.id || addressRows[0]?.id || "");
        setSlots(slotRows); setSlotId(slotRows[0]?.id || "");
        setProducts(productRows); setProductId(productRows.find((row) => row.productType === "standard_milk")?.id || productRows[0]?.id || "");
        setVendors(vendorRows);
        setCanteen(payloads[4].data.canteen as typeof canteen);
      } catch (e) { setError(e instanceof Error ? e.message : "Unable to load options."); }
      finally { setLoading(false); }
    })();
  }, []);

  const product = products.find((row) => row.id === productId);
  const isCanteen = product?.productType === "canteen_milk";
  const selectedVendor = isCanteen ? canteen : vendors.find((row) => row.id === vendorId);
  const vendorOptions = useMemo(() => vendors.filter((row) => row.orderingEnabled && row.verifiedOptions.some((option) => option.type === milkType)), [vendors, milkType]);

  useEffect(() => {
    if (isCanteen) {
      if (canteen?.orderable) setVendorId(canteen.id);
    } else if (!vendorOptions.some((row) => row.id === vendorId)) setVendorId(vendorOptions[0]?.id || "");
  }, [isCanteen, canteen, vendorOptions, vendorId]);

  async function getQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setQuote(null); setQuoting(true);
    try {
      const chosenVendorId = effectiveVendorId;
      let referenceVariantId = "";
      if (isCanteen) {
        referenceVariantId = canteen?.pricing.find((row) => row.litres === 1)?.productVariantId || "";
      } else {
        const option = vendors.find((row) => row.id === chosenVendorId)?.verifiedOptions.find((row) => row.type === milkType);
        referenceVariantId = option?.variantId1l || option?.variantId500ml || "";
      }
      if (!addressId || !slotId || !product || !chosenVendorId || !referenceVariantId) throw new Error("Choose an active address, delivery slot, milk and approved vendor.");
      const response = await fetch("/api/subscriptions/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId, deliverySlotId: slotId, startDate, planType: plan,
          items: [{ product_variant_id: referenceVariantId, vendor_id: chosenVendorId, milk_type: isCanteen ? "canteen" : milkType, quantity: Number(quantity), quantity_litres: Number(litres) }],
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Quote unavailable.");
      setQuote(payload.data.quote as Quote);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate quote."); }
    finally { setQuoting(false); }
  }

  if (loading) return <p className="rounded-2xl bg-white p-5 text-sm" role="status">Loading subscription options…</p>;

  return <div className="space-y-5">
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <form onSubmit={getQuote} className="grid gap-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-7">
      <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Delivery address
        <select required value={addressId} onChange={(e) => setAddressId(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal"><option value="">Choose address</option>{addresses.map((a) => <option key={a.id} value={a.id}>{a.address_type} · {a.recipient_name} · {a.address_line1} · {a.pincode}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Delivery slot
        <select required value={slotId} onChange={(e) => setSlotId(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal"><option value="">Choose slot</option>{slots.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">First delivery date
        <input required type="date" min={startDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Plan
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal"><option value="7_day">7 days · no discount</option><option value="30_day">30 days · ₹60 basket discount</option></select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Milk
        <select value={productId} onChange={(e) => { setProductId(e.target.value); setQuote(null); }} className="min-h-12 rounded-xl border border-border px-3 font-normal">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </label>
      {!isCanteen ? <label className="grid gap-1 text-sm font-semibold">Milk type
        <select value={milkType} onChange={(e) => setMilkType(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal"><option value="cow">Cow milk</option><option value="buffalo">Buffalo milk</option></select>
      </label> : null}
      <label className="grid gap-1 text-sm font-semibold">{isCanteen ? "Canteen supplier" : "Milk vendor"}
        <select required disabled={!!isCanteen} value={effectiveVendorId} onChange={(e) => setVendorId(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal">
          {isCanteen ? <option value={canteen?.id || ""}>{canteen?.name || "Canteen Milk Centre"}</option> : vendorOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Litres per day
        <select value={litres} onChange={(e) => setLitres(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal">{Array.from({length:20},(_,i)=>(i+1)*0.5).map((n) => <option key={n} value={n}>{n < 1 ? "500 ml" : n + " L"}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Quantity per day
        <input type="number" min="1" max="100" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="min-h-12 rounded-xl border border-border px-3 font-normal" />
      </label>
      <button type="submit" disabled={quoting || !addresses.length || !slots.length || !products.length} className="min-h-12 rounded-full bg-[#573b75] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{quoting ? "Calculating…" : "Calculate subscription quote"}</button>
    </form>
    {quote ? <section className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm sm:p-7">
      <p className="text-sm font-semibold text-highlight-ink">Server-calculated quote</p><h2 className="mt-1 text-2xl font-bold">{quote.duration_days}-day milk plan</h2><p className="mt-1 text-sm text-muted-foreground">{quote.start_date} to {quote.end_date}</p>
      <ul className="mt-4 space-y-2">{quote.items.map((item,index) => <li key={index} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><span>{item.product_name_snapshot} · {item.variant_name_snapshot}<span className="block text-xs text-muted-foreground">{item.vendor_name_snapshot}</span></span><strong>{money(item.line_total_paise)}</strong></li>)}</ul>
      <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>Plan subtotal</span><strong>{money(quote.subtotal_paise)}</strong></div><div className="flex justify-between"><span>Plan discount</span><strong>−{money(quote.discount_paise)}</strong></div><div className="flex justify-between border-t border-border pt-3 text-lg font-bold"><span>Total</span><span>{money(quote.total_paise)}</span></div></div>
      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Payment gateway integration is not live yet. This is a quote only: no subscription is created, no payment intent is charged, and no delivery is scheduled.</p>
    </section> : null}
  </div>;
}
