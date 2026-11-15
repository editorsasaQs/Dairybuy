import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgePercent, ShoppingCart, Trash2, Truck } from "lucide-react";
import milkImg from "@/assets/milk.jpg";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { milkVendors, presetLitres, formatQty, priceFor, type MilkType } from "@/lib/milk";

export const Route = createFileRoute("/milk")({
  head: () => ({
    meta: [
      { title: "Order Milk — Lacticious" },
      { name: "description", content: "Choose cow or buffalo milk from local vendors, pick your quantity and order for morning or evening delivery." },
      { property: "og:title", content: "Order fresh milk — Lacticious" },
      { property: "og:description", content: "Compare milk vendors, prices per litre and order cow or buffalo milk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MilkPage,
});

type Filter = "all" | MilkType;
type Line = { key: string; vendor: string; type: MilkType; litres: number; price: number; mrp: number };
const label = (t: MilkType) => (t === "cow" ? "Cow Milk" : "Buffalo Milk");
const cardBg = ["bg-ice", "bg-mint", "bg-peach", "bg-sun"];

function OptionRow({ vendor, opt, onAdd }: { vendor: string; opt: (typeof milkVendors)[number]["options"][number]; onAdd: (l: Line) => void }) {
  const [sel, setSel] = useState("1");
  const [custom, setCustom] = useState("");
  const litres = sel === "custom" ? Number(custom) : Number(sel);
  const valid = litres > 0 && litres <= 50;
  return (
    <div className="rounded-2xl bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg font-bold text-royal-deep">{label(opt.type)}</p>
        <span className="flex items-center gap-1 rounded-full bg-berry px-2 py-1 text-xs font-bold text-primary-foreground">
          <BadgePercent className="h-3 w-3" /> {opt.off}% OFF
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold text-royal-deep">₹{opt.price}</span>
        <span className="text-sm text-muted-foreground line-through">₹{opt.mrp}</span>
        <span className="text-sm text-muted-foreground">per litre</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label={`Quantity for ${vendor} ${label(opt.type)}`} value={sel} onChange={(e) => setSel(e.target.value)}
          className="rounded-full border-2 border-ice bg-background px-3 py-2 font-semibold text-royal-deep">
          {presetLitres.map((l) => <option key={l} value={String(l)}>{formatQty(l)}</option>)}
          <option value="custom">Custom quantity</option>
        </select>
        {sel === "custom" && (
          <input type="number" min={0.25} max={50} step={0.25} placeholder="Litres" value={custom} onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom quantity in litres" className="w-28 rounded-full border-2 border-ice px-3 py-2" />
        )}
      </div>
      <button disabled={!valid}
        onClick={() => onAdd({ key: `${vendor}-${opt.type}-${litres}`, vendor, type: opt.type, litres, price: priceFor(opt.price, litres), mrp: priceFor(opt.mrp, litres) })}
        className="mt-3 w-full rounded-full bg-royal py-2 font-bold text-primary-foreground transition hover:scale-[1.02] disabled:opacity-50">
        Add {valid ? `${formatQty(litres)} · ₹${priceFor(opt.price, litres)}` : ""}
      </button>
    </div>
  );
}

function MilkPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [cart, setCart] = useState<(Line & { count: number })[]>([]);
  const [placed, setPlaced] = useState(false);

  const add = (l: Line) => {
    setPlaced(false);
    setCart((c) => c.some((x) => x.key === l.key) ? c.map((x) => x.key === l.key ? { ...x, count: x.count + 1 } : x) : [...c, { ...l, count: 1 }]);
  };
  const total = cart.reduce((s, i) => s + i.price * i.count, 0);
  const saved = cart.reduce((s, i) => s + (i.mrp - i.price) * i.count, 0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <SiteHeader />
      <section className="bg-ice py-14">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_340px]">
          <div>
            <Link to="/" hash="products" className="text-sm font-bold text-royal hover:text-berry">← Back to our goodies</Link>
            <div className="mt-3 flex items-center gap-4">
              <img src={milkImg} alt="Milk" width={816} height={816} className="h-20 w-20 rounded-2xl border-4 border-background object-cover" />
              <div>
                <h1 className="text-4xl font-bold text-royal-deep md:text-5xl">Order fresh milk</h1>
                <p className="text-royal-deep">Pick a vendor, choose cow or buffalo milk and your quantity.</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {(["all", "cow", "buffalo"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`rounded-full px-6 py-2 font-bold transition ${filter === f ? "bg-royal text-primary-foreground shadow-pop" : "bg-background text-royal-deep hover:bg-peach"}`}>
                  {f === "all" ? "All" : label(f)}
                </button>
              ))}
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {milkVendors.map((v, i) => (
                <div key={v.id} className={`rounded-3xl border-4 border-background ${cardBg[i % 4]} p-5 shadow-pop`}>
                  <h2 className="text-2xl font-bold text-royal-deep">{v.name}</h2>
                  <div className="mt-4 grid gap-3">
                    {v.options.filter((o) => filter === "all" || o.type === filter).map((o) => (
                      <OptionRow key={o.type} vendor={v.name} opt={o} onAdd={add} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-3xl bg-background p-6 shadow-pop lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-royal"><ShoppingCart className="h-6 w-6" /> Your milk cart</h2>
            {placed ? (
              <div className="mt-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint"><Truck className="h-8 w-8 text-royal-deep" /></div>
                <p className="mt-4 font-display text-xl font-bold text-royal">Order placed!</p>
                <p className="mt-2 text-royal-deep">Your milk will arrive in the next morning or evening slot.</p>
              </div>
            ) : cart.length === 0 ? (
              <p className="mt-4 text-muted-foreground">Nothing added yet.</p>
            ) : (
              <>
                <ul className="mt-4 space-y-3">
                  {cart.map((i) => (
                    <li key={i.key} className="flex items-start justify-between gap-2 rounded-2xl bg-ice p-3 text-royal-deep">
                      <div>
                        <p className="text-xs font-bold uppercase text-royal">{i.vendor}</p>
                        <p className="font-bold">{label(i.type)} · {formatQty(i.litres)} × {i.count}</p>
                        <p className="text-sm">₹{i.price * i.count}</p>
                      </div>
                      <button aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.key !== i.key))}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-1 text-royal-deep">
                  <div className="flex justify-between text-berry"><span>You save</span><b>₹{saved}</b></div>
                  <div className="flex justify-between"><span>Delivery</span><b>FREE</b></div>
                  <div className="flex justify-between font-display text-xl font-bold"><span>Total</span><span>₹{total}</span></div>
                </div>
                <button onClick={() => { setPlaced(true); setCart([]); }}
                  className="mt-4 w-full rounded-full bg-royal py-3 font-display text-lg font-bold text-primary-foreground transition hover:scale-[1.02]">
                  Place order · ₹{total}
                </button>
              </>
            )}
          </aside>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
