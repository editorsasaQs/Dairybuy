import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/brand/Container";
import { DeliveryInfo } from "@/components/delivery/DeliveryInfo";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Us — Dairybuy",
  description:
    "Meet Dairybuy: a centrally managed dairy business in Kolkata that collects milk from approved vendors and delivers dairy essentials in morning and evening windows.",
  openGraph: {
    title: "About Dairybuy",
    description:
      "A centrally managed dairy business: approved milk vendors, Misti Doi, Tok Doi, ghee, butter, cheese and Firni in Kolkata.",
    type: "website",
  },
};

const commitments = [
  {
    step: "01. Managed Sourcing",
    title: "Milk collected from approved vendors",
    body: "Dairybuy staff collect milk from approved vendors. For cow and buffalo milk you will be able to choose the vendor; every other product comes from Dairybuy's own catalogue.",
  },
  {
    step: "02. Twice-Daily Freshness",
    title: "Morning and evening delivery windows",
    body: "Fresh milk and curd fit naturally around your household routine, with morning breakfast and evening kitchen delivery windows.",
  },
  {
    step: "03. Bengali Dairy Heritage",
    title: "Everyday staples & traditional favourites",
    body: "Alongside daily cow and buffalo milk, we bring confirmed Bengali dairy favourites including Misti Doi, Tok Doi, Firni, pure ghee, butter and cheese.",
  },
  {
    step: "04. Less Waste, Honest Care",
    title: "Mindful packaging & transparent handling",
    body: "Thoughtful bottle and pack handling designed for repeat neighbourhood households rather than one-off impulse shipping.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="db-page">
      <Container as="section" className="py-(--section-y)">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <div className="db-visual overflow-hidden rounded-[2.5rem] border-[8px] border-[#ffd329] bg-[#ffd329] p-2 shadow-pop">
            {/* Provisional original asset retained per Phase 2 ASSET_MANIFEST.md */}
            <Image
              src="/images/original/hello.jpg"
              alt="Dairybuy delivery team member holding fresh milk bottles"
              width={1024}
              height={1024}
              sizes="(min-width: 1024px) 460px, 100vw"
              priority
              className="aspect-square w-full rounded-[2rem] border-4 border-white object-cover"
            />
          </div>

          <div>
            <p className="db-kicker inline-flex rounded-full bg-[#ffd329] px-4 py-2 text-sm font-extrabold text-[#284967]">
              About Dairybuy · Kolkata
            </p>
            <h1 className="mt-2">Pure neighbourhood dairy, without the queue.</h1>
            <p className="mt-5 text-base leading-relaxed text-foreground sm:text-lg">
              Dairybuy started with a straightforward conviction: every Kolkata home deserves fresh, dependable milk and dairy without standing in morning queues or guessing about quality.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              From daily cow and buffalo milk from approved vendors to traditional Misti Doi, Firni, curd, pure ghee, and breakfast staples, Dairybuy collects milk from approved vendors and delivers it to your doorstep in morning and evening windows.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/products"
                className={buttonClasses(
                  "primary",
                  "text-primary-foreground no-underline",
                )}
              >
                Explore Catalogue
              </Link>
              <Link
                href="/milk"
                className={buttonClasses(
                  "secondary",
                  "text-secondary-foreground no-underline",
                )}
              >
                Choose Milk Vendor
              </Link>
            </div>
          </div>
        </div>
      </Container>

      <section className="border-y border-border bg-muted/70">
        <Container className="py-(--section-y)">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-highlight-ink">
              What Guides Us
            </p>
            <h2 className="mt-2">Built for everyday Kolkata kitchens</h2>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {commitments.map((item) => (
              <article
                key={item.step}
                className="db-panel rounded-[2rem] border-2 border-white bg-[#dff5fc] p-6 shadow-pop"
              >
                <p className="text-xs font-semibold text-highlight-ink">
                  {item.step}
                </p>
                <h3 className="mt-2 text-card-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <Container as="section" id="how-we-work" className="py-(--section-y)">
        <div className="db-panel rounded-[2.5rem] border-2 border-white bg-[#ffd0ae] p-6 shadow-pop sm:p-10">
          <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm font-semibold text-highlight-ink">
                How Dairybuy Is Run
              </p>
              <h2 className="mt-2">One business, managed end to end</h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                Dairybuy is a single, centrally managed dairy business. Our staff collect milk from approved vendors and manage orders and delivery.
              </p>
              <ul className="mt-4 max-w-xl list-disc space-y-1.5 pl-5 text-base leading-relaxed text-muted-foreground">
                <li>Cow and buffalo milk is the only category with vendor selection.</li>
                <li>All other products come from Dairybuy&apos;s central catalogue, with no vendor choice.</li>
                <li>Canteen milk is a separate single-vendor arrangement.</li>
              </ul>
            </div>

            <DeliveryInfo />
          </div>
        </div>
      </Container>
    </main>
  );
}
