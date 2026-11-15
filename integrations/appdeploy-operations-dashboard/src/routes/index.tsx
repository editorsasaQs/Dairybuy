import type React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRoundPlus, ShoppingBasket, Truck, Gift } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { OrderNow } from "@/components/OrderNow";
import combo from "@/assets/combo.jpg";
import milk from "@/assets/milk.jpg";
import juice from "@/assets/juice.jpg";
import bread from "@/assets/bread.jpg";
import egg from "@/assets/egg.jpg";
import butter from "@/assets/butter.jpg";
import ghee from "@/assets/ghee.jpg";
import jam from "@/assets/jam.jpg";
import curd from "@/assets/curd.jpg";
import mistidoi from "@/assets/mistidoi.jpg";
import firni from "@/assets/firni.jpg";
import banana from "@/assets/banana.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lacticious — Fresh Dairy & Breakfast Delivered Daily" },
      { name: "description", content: "Milk, curd, misti doi, ghee, bread, eggs and more delivered fresh to your doorstep in the morning and evening by Lacticious." },
      { property: "og:title", content: "Lacticious — Fresh Dairy Delivered Daily" },
      { property: "og:description", content: "Fresh milk, dairy and breakfast essentials at your door in the morning and evening." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const products = [
  { name: "Milk", img: milk, bg: "bg-sun" },
  { name: "Juice", img: juice, bg: "bg-berry" },
  { name: "Bread", img: bread, bg: "bg-mint" },
  { name: "Egg", img: egg, bg: "bg-peach" },
  { name: "Butter", img: butter, bg: "bg-ice" },
  { name: "Ghee", img: ghee, bg: "bg-sun" },
  { name: "Jam", img: jam, bg: "bg-coral" },
  { name: "Curd", img: curd, bg: "bg-mint" },
  { name: "Misti Doi", img: mistidoi, bg: "bg-peach" },
  { name: "Firni", img: firni, bg: "bg-ice" },
  { name: "Banana", img: banana, bg: "bg-sun" },
];

function ProductTile({ isMilk, children }: { isMilk: boolean; children: React.ReactNode }) {
  return isMilk ? <Link to="/milk" className="group block">{children}</Link> : <div className="group">{children}</div>;
}

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="relative bg-background pb-24 pt-12 text-royal-deep">
        <div className="absolute -left-20 top-20 h-64 w-64 animate-spin-slow rounded-[40%] bg-ice opacity-80" />
        <div className="absolute right-10 top-10 h-24 w-24 animate-floaty rounded-full bg-berry opacity-80" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-2">
          <div>
            <span className="inline-block -rotate-3 rounded-xl bg-sun px-4 py-1 font-display font-bold text-royal-deep">
              Fresh mornings & evenings ☀
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-tight md:text-7xl">
              Doodh Wahi,<br /><span className="text-berry">Tareeka Naya!</span>
            </h1>
            <p className="mt-6 max-w-md text-lg">
              <span className="block font-display text-2xl font-semibold">Line Chodo, Lacticious Kholo.</span>
              <span className="mt-3 block">Milk, dairy delights and breakfast essentials from local vendors and farms, delivered in the morning and evening.</span>
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#products" className="rounded-full bg-royal px-7 py-3 font-bold text-primary-foreground shadow-pop transition hover:-translate-y-1">Shop products</a>
              <a href="#how" className="rounded-full border-2 border-royal px-7 py-3 font-bold transition hover:bg-ice">How it works</a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rotate-3 rounded-[2rem] bg-sun" />
            <img src={hero} alt="Lacticious milkman delivering at sunrise" width={1536} height={1024} className="relative rounded-[2rem] border-4 border-background" />
            <div className="absolute -bottom-6 -left-6 animate-wiggle rounded-2xl bg-coral px-5 py-3 font-display text-xl font-bold text-primary-foreground">
              Fresh & honest!
            </div>
          </div>
        </div>
        <svg className="absolute bottom-0 left-0 w-full text-ice" viewBox="0 0 1440 80" preserveAspectRatio="none"><path fill="currentColor" d="M0,40 C360,90 1080,-10 1440,40 L1440,80 L0,80 Z" /></svg>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden bg-ice py-4">
        <div className="flex w-max animate-marquee gap-10 font-display text-2xl font-bold text-royal">
          {Array.from({ length: 2 }).flatMap((_, i) =>
            ["Fresh milk", "Misti Doi", "Pure Ghee", "Reusable bottles", "Morning & evening delivery"].map((t) => (
              <span key={t + i} className="flex items-center gap-10">{t} <span className="text-berry">✦</span></span>
            )),
          )}
        </div>
      </div>

      {/* Products */}
      <section id="products" className="bg-ice py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-royal md:text-5xl">Our goodies</h2>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductTile key={p.name} isMilk={p.name === "Milk"}>
                <div className={`aspect-square overflow-hidden rounded-3xl border-4 border-background ${p.bg} shadow-pop transition duration-300 group-hover:-translate-y-2 group-hover:rotate-1`}>
                  <img src={p.img} alt={p.name} loading="lazy" width={816} height={816} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" style={{ animationDelay: `${i * 0.2}s` }} />
                </div>
                <p className="mt-4 text-center font-display text-xl font-bold text-royal">{p.name}</p>
                {p.name === "Milk" && <p className="text-center text-sm font-bold text-berry">Tap to choose vendor →</p>}
              </ProductTile>
            ))}
            <div className="flex aspect-square flex-col items-center justify-center rounded-3xl bg-royal p-6 text-center text-primary-foreground shadow-pop">
              <span className="font-display text-3xl font-bold">More coming soon!</span>
              <span className="mt-2 text-sun">🥛 ✦ 🍞</span>
            </div>
          </div>
        </div>
      </section>

      {/* Order now */}
      <OrderNow />

      {/* Breakfast combo */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-sun p-8 shadow-pop md:grid-cols-2 md:p-14">
            <div className="absolute -right-16 -top-16 h-56 w-56 animate-spin-slow rounded-[35%] bg-coral opacity-50" />
            <div className="relative">
              <span className="inline-block -rotate-3 rounded-xl bg-royal px-4 py-1 font-display font-bold text-primary-foreground">Sunrise Combo</span>
              <h2 className="mt-4 text-4xl font-bold text-royal-deep md:text-5xl">The Breakfast Box</h2>
              <p className="mt-4 text-lg text-royal-deep">Everything for a happy morning in one box.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Milk", "Bread", "Egg", "Banana", "Butter"].map((x, i) => (
                  <span key={x} className={`rounded-full px-4 py-2 font-bold ${["bg-background text-royal", "bg-mint text-royal-deep", "bg-peach text-royal-deep", "bg-ice text-royal", "bg-berry text-primary-foreground"][i]}`}>{x}</span>
                ))}
              </div>
              <a href="#contact" className="mt-8 inline-block rounded-full bg-royal px-8 py-3 font-bold text-primary-foreground transition hover:scale-105">Get the combo</a>
            </div>
            <img src={combo} alt="Breakfast combo with milk, bread, eggs, bananas and butter" loading="lazy" width={1024} height={768} className="relative animate-floaty rounded-3xl border-4 border-background" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-background py-20 text-royal-deep">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-4xl font-bold md:text-5xl">How it works</h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Create an account", description: "Sign up and add your delivery address.", Icon: UserRoundPlus, color: "bg-ice" },
              { title: "Place your order", description: "Pick your favourite milk, dairy and breakfast essentials.", Icon: ShoppingBasket, color: "bg-mint" },
              { title: "Easy doorstep delivery", description: "Fresh deliveries at your doorstep in the morning and evening.", Icon: Truck, color: "bg-peach" },
              { title: "Repeat & enjoy rewards", description: "Repeat your order to claim offers and discounts.", Icon: Gift, color: "bg-sun" },
            ].map(({ title, description, Icon, color }, i) => (
              <div key={title} className="transition hover:-translate-y-2">
                <div className={`relative mx-auto flex h-28 w-28 items-center justify-center rounded-full ${color}`}>
                  <Icon className="h-12 w-12" strokeWidth={1.5} aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-royal font-display font-bold text-primary-foreground">{i + 1}</span>
                </div>
                <h3 className="mt-6 text-2xl font-bold">{title}</h3>
                <p className="mt-3">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section id="why" className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-4xl font-bold text-royal md:text-5xl">Why choose us?</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["🐄", "From local vendors & farms to your doorstep", "Goodness from your local community.", "bg-mint rounded-[2rem_0.5rem_2rem_0.5rem]"],
              ["🫙", "Reusable bottles", "Use again, waste less.", "bg-sun rounded-full aspect-square flex flex-col justify-center"],
              ["⏰", "Milk delivery in morning and evening", "Fresh milk at your doorstep, twice a day.", "bg-peach rounded-[0.5rem_2rem_0.5rem_2rem]"],
              ["♡", "Fresh and honest, always", "Goodness in every delivery.", "bg-ice rounded-3xl"],
            ].map(([e, t, d, c]) => (
              <div key={t} className={`p-8 text-royal-deep transition hover:scale-105 ${c}`}>
                <div className="text-5xl">{e}</div>
                <h3 className="mt-4 text-xl font-bold">{t}</h3>
                <p className="mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendors */}
      <section id="vendors" className="bg-peach py-20 text-royal-deep">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
          <div>
            <span className="inline-block -rotate-2 rounded-xl bg-sun px-4 py-1 font-display font-bold text-royal-deep">Vendors</span>
            <h2 className="mt-4 text-4xl font-bold md:text-5xl">Grow with Lacticious</h2>
            <p className="mt-4 text-lg">Are you a dairy farmer, baker or local producer? Partner with us and reach thousands of happy homes.</p>
            <a href="#contact" className="mt-8 inline-block rounded-full bg-royal px-8 py-3 font-bold text-primary-foreground transition hover:scale-105">Become a vendor</a>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[["", "Local vendors / farms", "bg-berry text-primary-foreground"], ["", "Delivery partners", "bg-coral text-primary-foreground"], ["", "Happy homes", "bg-mint text-royal-deep"], ["365", "Days a year", "bg-ice text-royal"]].map(([n, l, c]) => (
              <div key={l} className={`flex min-h-36 flex-col items-center justify-center rounded-3xl p-6 text-center ${c}`}>
                {n && <div className="font-display text-4xl font-bold">{n}</div>}
                <div className={`font-display text-xl font-semibold ${n ? "mt-1" : ""}`}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-ice py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-[2.5rem] bg-background p-8 shadow-pop md:p-12">
            <h2 className="text-center text-4xl font-bold text-royal">Say hello 👋</h2>
            <form onSubmit={(e) => { e.preventDefault(); alert("Thanks! We'll be in touch soon."); }} className="mt-8 grid gap-4">
              <input required placeholder="Your name" className="rounded-2xl border-2 border-ice bg-background px-5 py-3 outline-none focus:border-royal" />
              <input required type="email" placeholder="Email" className="rounded-2xl border-2 border-ice bg-background px-5 py-3 outline-none focus:border-royal" />
              <textarea required rows={4} placeholder="Your message" className="rounded-2xl border-2 border-ice bg-background px-5 py-3 outline-none focus:border-royal" />
              <button className="rounded-full bg-royal py-3 font-bold text-primary-foreground transition hover:scale-[1.02]">Send message</button>
            </form>
            <p className="mt-6 text-center text-muted-foreground">hello@lacticious.com · +91 00000 00000</p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
