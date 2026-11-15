import { useMemo, useState } from "react";
import { ShoppingCart, Plus, Minus, X, BadgePercent, Truck } from "lucide-react";
import milk from "@/assets/milk.jpg";
import curd from "@/assets/curd.jpg";
import mistidoi from "@/assets/mistidoi.jpg";
import ghee from "@/assets/ghee.jpg";
import butter from "@/assets/butter.jpg";
import bread from "@/assets/bread.jpg";
import egg from "@/assets/egg.jpg";
import banana from "@/assets/banana.jpg";
import juice from "@/assets/juice.jpg";
import jam from "@/assets/jam.jpg";
import firni from "@/assets/firni.jpg";
import { milkVendors } from "@/lib/milk";

type Product = {
  id: string;
  name: string;
  vendor?: string;
  unit: string;
  mrp: number;
  price: number;
  off: string;
  img: string;
  bg: string;
};

const catalogue: Product[] = [
  ...milkVendors.flatMap((v, vi) =>
    v.options.map((o, oi) => ({
      id: `${v.id}-${o.type}`, name: o.type === "cow" ? "Cow Milk" : "Buffalo Milk", vendor: v.name, unit: "1 L",
      mrp: o.mrp, price: o.price, off: `${o.off}% OFF`, img: milk, bg: ["bg-ice", "bg-mint", "bg-peach", "bg-sun"][(vi + oi) % 4],
    })),
  ),
  { id: "curd", name: "Curd", unit: "400 g", mrp: 40, price: 35, off: "12% OFF", img: curd, bg: "bg-mint" },
  { id: "mistidoi", name: "Misti Doi", unit: "200 g", mrp: 50, price: 45, off: "10% OFF", img: mistidoi, bg: "bg-peach" },
  { id: "ghee", name: "Pure Ghee", unit: "500 ml", mrp: 650, price: 599, off: "8% OFF", img: ghee, bg: "bg-sun" },
  { id: "butter", name: "Butter", unit: "100 g", mrp: 60, price: 55, off: "8% OFF", img: butter, bg: "bg-ice" },
  { id: "bread", name: "Bread", unit: "400 g", mrp: 45, price: 40, off: "11% OFF", img: bread, bg: "bg-mint" },
  { id: "egg", name: "Eggs", unit: "6 pcs", mrp: 48, price: 42, off: "12% OFF", img: egg, bg: "bg-peach" },
  { id: "banana", name: "Banana", unit: "6 pcs", mrp: 40, price: 35, off: "12% OFF", img: banana, bg: "bg-sun" },
  { id: "juice", name: "Juice", unit: "1 L", mrp: 120, price: 99, off: "17% OFF", img: juice, bg: "bg-berry" },
  { id: "jam", name: "Jam", unit: "200 g", mrp: 90, price: 79, off: "12% OFF", img: jam, bg: "bg-coral" },
  { id: "firni", name: "Firni", unit: "200 g", mrp: 60, price: 55, off: "8% OFF", img: firni, bg: "bg-ice" },
];

type Cart = Record<string, number>;

export function OrderNow() {
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState(false);

  const items = useMemo(
    () => catalogue.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] ?? 0 })),
    [cart],
  );
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const savings = items.reduce((s, i) => s + i.qty * (i.mrp - i.price), 0);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) =>
    setCart((c) => {
      const q = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  return (
    <section id="order" className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-block -rotate-2 rounded-xl bg-berry px-4 py-1 font-display font-bold text-primary-foreground">Order now</span>
            <h2 className="mt-4 text-4xl font-bold text-royal md:text-5xl">Fresh picks, happy prices</h2>
            <p className="mt-2 text-lg text-royal-deep">Add to cart and get it delivered in the morning or evening.</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-royal px-6 py-3 font-bold text-primary-foreground shadow-pop transition hover:scale-105"
          >
            <ShoppingCart className="h-5 w-5" /> View cart
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-berry font-display text-sm font-bold text-primary-foreground">{count}</span>
            )}
          </button>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {catalogue.map((p) => {
            const qty = cart[p.id] ?? 0;
            return (
              <div key={p.id} className={`flex flex-col rounded-3xl border-2 border-ice ${p.bg} p-3 shadow-pop transition hover:-translate-y-1`}>
                <div className="relative overflow-hidden rounded-2xl bg-background">
                  <img src={p.img} alt={p.name} loading="lazy" width={816} height={816} className="aspect-square w-full object-cover" />
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-berry px-2 py-1 text-xs font-bold text-primary-foreground">
                    <BadgePercent className="h-3 w-3" /> {p.off}
                  </span>
                </div>
                {p.vendor && <p className="mt-3 text-xs font-bold uppercase tracking-wide text-royal">{p.vendor}</p>}
                <p className={`${p.vendor ? "mt-1" : "mt-3"} font-display text-lg font-bold leading-tight text-royal-deep`}>{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.unit}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold text-royal-deep">₹{p.price}</span>
                  <span className="text-sm text-muted-foreground line-through">₹{p.mrp}</span>
                </div>
                <div className="mt-3">
                  {qty === 0 ? (
                    <button onClick={() => add(p.id)} className="w-full rounded-full bg-royal py-2 font-bold text-primary-foreground transition hover:scale-[1.03]">
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center justify-between rounded-full bg-royal px-2 py-1 text-primary-foreground">
                      <button onClick={() => sub(p.id)} aria-label={`Remove one ${p.name}`} className="rounded-full p-1 transition hover:bg-royal-deep"><Minus className="h-4 w-4" /></button>
                      <span className="font-display font-bold">{qty}</span>
                      <button onClick={() => add(p.id)} aria-label={`Add one ${p.name}`} className="rounded-full p-1 transition hover:bg-royal-deep"><Plus className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-royal-deep/50" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-background p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-royal">Your cart</h3>
              <button onClick={() => setOpen(false)} aria-label="Close cart" className="rounded-full bg-ice p-2 transition hover:bg-peach"><X className="h-5 w-5" /></button>
            </div>

            {placed ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-mint"><Truck className="h-12 w-12 text-royal-deep" /></div>
                <h4 className="mt-6 font-display text-3xl font-bold text-royal">Order placed!</h4>
                <p className="mt-3 text-royal-deep">Thank you! Your fresh goodies will arrive at your doorstep in the next morning or evening slot.</p>
                <button
                  onClick={() => { setPlaced(false); setOpen(false); }}
                  className="mt-8 rounded-full bg-royal px-8 py-3 font-bold text-primary-foreground transition hover:scale-105"
                >
                  Continue shopping
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <ShoppingCart className="h-16 w-16 text-ice" />
                <p className="mt-4 font-display text-xl font-bold text-royal">Your cart is empty</p>
                <p className="mt-2 text-muted-foreground">Add some fresh goodies to get started.</p>
              </div>
            ) : (
              <>
                <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 rounded-2xl border-2 border-ice p-3">
                      <img src={i.img} alt={i.name} width={816} height={816} className="h-16 w-16 rounded-xl object-cover" />
                      <div className="flex-1">
                        {i.vendor && <p className="text-[10px] font-bold uppercase tracking-wide text-royal">{i.vendor}</p>}
                        <p className="font-display font-bold text-royal-deep">{i.name}</p>
                        <p className="text-sm text-muted-foreground">₹{i.price} <span className="line-through">₹{i.mrp}</span> · {i.unit}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-ice px-2 py-1">
                        <button onClick={() => sub(i.id)} aria-label={`Remove one ${i.name}`}><Minus className="h-4 w-4" /></button>
                        <span className="w-5 text-center font-bold">{i.qty}</span>
                        <button onClick={() => add(i.id)} aria-label={`Add one ${i.name}`}><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-2 rounded-2xl bg-ice p-4 text-royal-deep">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">₹{total}</span></div>
                  <div className="flex justify-between text-berry"><span>You save</span><span className="font-bold">₹{savings}</span></div>
                  <div className="flex justify-between"><span>Delivery</span><span className="font-bold text-mint">FREE</span></div>
                  <div className="flex justify-between border-t-2 border-background pt-2 font-display text-xl font-bold"><span>Total</span><span>₹{total}</span></div>
                </div>
                <button
                  onClick={() => { setPlaced(true); setCart({}); }}
                  className="mt-4 w-full rounded-full bg-royal py-3 font-display text-lg font-bold text-primary-foreground shadow-pop transition hover:scale-[1.02]"
                >
                  Place order · ₹{total}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
