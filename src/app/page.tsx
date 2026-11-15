import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Milk, Truck, Users } from "lucide-react";
import { Container } from "@/components/brand/Container";
import { FeaturedCatalogue } from "@/components/catalogue/FeaturedCatalogue";
import { buttonClasses } from "@/components/ui/button";
import { deliveryFeeLabel } from "@/lib/business";

const categories = [
  { name: "Milk", image: "/images/products/milk.jpg", tone: "bg-[#fff0a8]", note: "Choose your vendor", href: "/milk" },
  { name: "Curd", image: "/images/products/curd.jpg", tone: "bg-[#bce8d2]", href: "/products" },
  { name: "Misti Doi", image: "/images/products/mistidoi.jpg", tone: "bg-[#ffd0b3]", href: "/products" },
  { name: "Ghee", image: "/images/products/ghee.jpg", tone: "bg-[#ffdf55]", href: "/products" },
  { name: "Butter", image: "/images/products/butter.jpg", tone: "bg-[#dff5fc]", href: "/products" },
  { name: "Bread", image: "/images/products/bread.jpg", tone: "bg-[#bce8d2]", href: "/products" },
] as const;

const steps = [
  { n: "1", icon: Users, title: "Create an account", text: "Sign up and add your delivery address.", tone: "bg-[#dff5fc]" },
  { n: "2", icon: Milk, title: "Place your order", text: "Pick your favourite milk, dairy and breakfast essentials.", tone: "bg-[#80e0b1]" },
  { n: "3", icon: Truck, title: "Easy doorstep delivery", text: "Fresh deliveries in the morning and evening windows.", tone: "bg-[#ffd0ae]" },
  { n: "4", icon: Gift, title: "Repeat & enjoy", text: "Shop again whenever your home needs fresh essentials.", tone: "bg-[#ffd329]" },
] as const;

const benefits = [
  { icon: "🐄", title: "Local sourcing, centrally managed", text: "Milk is collected from approved vendors by Dairybuy staff.", tone: "bg-[#80e0b1]" },
  { icon: "🫙", title: "Reusable bottles", text: "Choose reusable packaging where the service supports it.", tone: "bg-[#ffd329]" },
  { icon: "⏰", title: "Morning & evening delivery", text: "Choose an available delivery window at checkout.", tone: "bg-[#ffd0ae]" },
  { icon: "♡", title: "Fresh and honest, always", text: "Clear product and pricing information before you order.", tone: "bg-[#dff5fc]" },
] as const;

export default function Home() {
  return (
    <main className="home-reference">
      <section className="home-hero relative overflow-hidden bg-white">
        <Container className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:py-16">
          <div className="relative z-10">
            <p className="home-kicker inline-flex -rotate-2 items-center rounded-full bg-[#ffd329] px-5 py-2 text-sm font-extrabold text-[#284967] shadow-pop">Fresh mornings & evenings ☀</p>
            <h1 className="home-display mt-7 max-w-2xl text-[#284967]">Doodh Wahi,<br/><span className="text-[#e63fa6]">Tareeka Naya!</span></h1>
            <h2 className="mt-5 font-heading text-2xl font-extrabold text-[#284967] sm:text-3xl">Line Chodo, Dairybuy Kholo.</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#405b72] sm:text-lg">Milk, dairy delights and breakfast essentials from approved local vendors, collected and delivered by Dairybuy in the morning and evening.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className={buttonClasses("primary", "home-button min-h-12 rounded-full bg-[#528cb5] px-7 text-white shadow-pop no-underline")}>Shop products</Link>
              <Link href="#how-it-works" className="home-button inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#528cb5] bg-white px-7 font-bold text-[#284967] no-underline">How it works</Link>
            </div>
          </div>
          <div className="home-hero-photo relative mx-auto w-full max-w-xl rounded-[2.5rem] border-[10px] border-[#ffd329] bg-[#ffd329] p-2 shadow-pop">
            <Image src="/images/banners/hero.jpg" alt="Dairy delivery at a customer's doorstep" width={1536} height={1024} priority sizes="(min-width: 1024px) 48vw, 100vw" className="aspect-[4/3] w-full rounded-[2rem] border-[5px] border-white object-cover"/>
            <span className="absolute -bottom-5 -left-4 rotate-[-5deg] rounded-full bg-[#fa7774] px-6 py-3 font-heading text-lg font-extrabold text-white">Fresh & honest!</span>
          </div>
        </Container>
      </section>

      <section className="home-categories bg-[#dff5fc] py-16 sm:py-20">
        <Container>
          <div className="home-marquee mb-12 overflow-hidden whitespace-nowrap text-[#528cb5]">Morning & evening delivery ✦ Reusable bottles ✦ Fresh dairy ✦</div>
          <h2 className="home-section-title text-center text-[#528cb5]">Our goodies</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-9 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
            {categories.map((category) => (
              <Link href={category.href} key={category.name} className="home-category-card group text-center no-underline">
                <div className={`home-category-image ${category.tone} rounded-[2.5rem] border-[5px] border-white p-2 shadow-pop transition-transform group-hover:-translate-y-1`}>
                  <Image src={category.image} alt={category.name} width={640} height={640} sizes="(min-width: 1024px) 25vw, 45vw" className="aspect-square w-full rounded-[2rem] object-cover"/>
                </div>
                <h3 className="mt-4 font-heading text-xl font-extrabold text-[#528cb5] sm:text-2xl">{category.name}</h3>
                {"note" in category && <p className="mt-1 text-sm font-bold text-[#e63fa6]">{category.note} →</p>}
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <Container as="section" id="products" className="py-16 sm:py-20">
        <div className="mb-9 max-w-2xl">
          <p className="home-kicker inline-flex rounded-full bg-[#e63fa6] px-4 py-2 text-sm font-bold text-white">Fresh picks</p>
          <h2 className="home-section-title mt-5 text-[#528cb5]">Fresh picks, happy prices</h2>
          <p className="mt-3 text-base text-[#405b72] sm:text-lg">Add to cart and get it delivered in the morning or evening.</p>
          <Link href="/products" className={buttonClasses("primary", "home-button mt-5 min-h-12 rounded-full bg-[#528cb5] px-7 text-white shadow-pop no-underline")}>View all products <ArrowRight className="ml-2 h-4 w-4"/></Link>
        </div>
        <FeaturedCatalogue />
        <p className="mt-6 text-xs text-muted-foreground">{deliveryFeeLabel()} Prices and availability are confirmed from the live Dairybuy catalogue.</p>
      </Container>

      <section id="breakfast-box" className="bg-white py-12 sm:py-16">
        <Container>
          <div className="home-breakfast relative overflow-hidden rounded-[3rem] bg-[#ffd329] p-7 shadow-pop sm:p-10 lg:p-14">
            <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#ffa34d]" aria-hidden="true"/>
            <div className="relative z-10 max-w-xl">
              <p className="inline-flex -rotate-2 rounded-full bg-[#528cb5] px-5 py-2 font-heading font-extrabold text-white">Sunrise Combo</p>
              <h2 className="home-section-title mt-6 text-[#284967]">The Breakfast Box</h2>
              <p className="mt-4 text-lg leading-relaxed text-[#405b72]">Everything for a happy morning in one box.</p>
              <div className="mt-6 flex max-w-md flex-wrap gap-3">
                {["Milk","Bread","Breakfast essentials"].map((item,i)=><span key={item} className={`rounded-full px-5 py-2 font-bold text-[#284967] ${["bg-white","bg-[#80e0b1]","bg-[#ffd0ae]"][i]}`}>{item}</span>)}
              </div>
              <Link href="/products" className={buttonClasses("primary", "home-button mt-7 min-h-12 rounded-full bg-[#528cb5] px-7 text-white no-underline")}>Explore the combo ideas</Link>
            </div>
            <div className="relative z-10 mt-8 rotate-1 overflow-hidden rounded-[2.5rem] border-[6px] border-white shadow-pop lg:ml-auto lg:mt-[-1rem] lg:max-w-[52%]">
              <Image src="/images/banners/combo.jpg" alt="Milk, bread and breakfast foods arranged together" width={1024} height={768} sizes="(min-width: 1024px) 48vw, 100vw" className="aspect-[4/3] w-full object-cover"/>
            </div>
            <p className="relative z-10 mt-5 text-xs text-[#405b72]">Breakfast inspiration only — individual products are ordered separately from the live catalogue.</p>
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="bg-white py-16 sm:py-20">
        <Container>
          <h2 className="home-section-title text-center text-[#284967]">How it works</h2>
          <div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step)=>{const Icon=step.icon;return <article key={step.n} className="text-center">
              <div className={`relative mx-auto flex h-40 w-40 items-center justify-center rounded-full ${step.tone}`}>
                <Icon className="h-14 w-14 text-[#284967]" strokeWidth={1.8}/>
                <span className="absolute -right-1 top-0 flex h-12 w-12 items-center justify-center rounded-full bg-[#528cb5] text-xl font-extrabold text-white">{step.n}</span>
              </div>
              <h3 className="mt-7 font-heading text-xl font-extrabold text-[#284967]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#405b72]">{step.text}</p>
            </article>})}
          </div>
        </Container>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <Container>
          <h2 className="home-section-title text-center text-[#528cb5]">Why choose us?</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {benefits.map((benefit)=><article key={benefit.title} className={`home-benefit-card flex min-h-64 flex-col items-center justify-center rounded-[2.5rem] p-8 text-center ${benefit.tone}`}>
              <span className="text-5xl" aria-hidden="true">{benefit.icon}</span>
              <h3 className="mt-6 max-w-sm font-heading text-xl font-extrabold text-[#284967]">{benefit.title}</h3>
              <p className="mt-3 max-w-sm text-[#405b72]">{benefit.text}</p>
            </article>)}
          </div>
        </Container>
      </section>

      <section className="bg-[#ffd0ae] py-16 sm:py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex -rotate-2 rounded-full bg-[#ffd329] px-5 py-2 font-heading font-extrabold text-[#284967]">Local sourcing</p>
              <h2 className="home-section-title mt-5 text-[#284967]">Working with local dairy suppliers</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#405b72]">We work with local dairy vendors and producers while keeping sourcing, stock, customer orders and delivery centrally managed by Dairybuy.</p>
              <Link href="/about#how-we-work" className={buttonClasses("primary", "home-button mt-7 min-h-12 rounded-full bg-[#528cb5] px-7 text-white no-underline")}>Learn about our model</Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex min-h-36 items-center justify-center rounded-[2rem] bg-[#e63fa6] p-5 text-center font-heading text-xl font-extrabold text-white">Local vendors<br/> & farms</div>
              <div className="flex min-h-36 items-center justify-center rounded-[2rem] bg-[#fa7774] p-5 text-center font-heading text-xl font-extrabold text-white">Dairybuy<br/> delivery</div>
              <div className="flex min-h-36 items-center justify-center rounded-[2rem] bg-[#80e0b1] p-5 text-center font-heading text-xl font-extrabold text-[#284967]">Neighbourhood<br/> homes</div>
              <div className="flex min-h-36 items-center justify-center rounded-[2rem] bg-[#dff5fc] p-5 text-center font-heading text-xl font-extrabold text-[#528cb5]">One service<br/> all year</div>
            </div>
          </div>
        </Container>
      </section>

      <section id="contact" className="bg-[#dff5fc] py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl rounded-[3rem] border-[5px] border-white bg-white p-7 text-center shadow-pop sm:p-12">
            <h2 className="home-section-title text-[#528cb5]">Say hello 👋</h2>
            <p className="mx-auto mt-4 max-w-xl text-[#405b72]">We’re preparing verified customer support details for Dairybuy. Explore the live catalogue or learn more about how our service works.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/products" className={buttonClasses("primary", "home-button min-h-12 rounded-full bg-[#528cb5] px-7 text-white no-underline")}>Shop products</Link>
              <Link href="/about" className="inline-flex min-h-12 items-center rounded-full border-2 border-[#528cb5] px-7 font-bold text-[#284967] no-underline">About Dairybuy</Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
