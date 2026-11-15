import Link from "next/link";
import { Container } from "@/components/brand/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { DeliveryInfo } from "@/components/delivery/DeliveryInfo";

const exploreLinks = [
  { label: "Home", href: "/" },
  { label: "Product Catalogue", href: "/products" },
  { label: "Milk Options", href: "/milk" },
  { label: "About Dairybuy", href: "/about" },
] as const;

const usefulLinks = [
  { label: "How Dairybuy Works", href: "/#how-it-works" },
  { label: "Breakfast inspiration", href: "/#breakfast-box" },
  { label: "How Dairybuy is managed", href: "/about#how-we-work" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t-0 bg-[#528cb5] text-white">
      <Container className="py-12 sm:py-14">
        <div className="grid gap-9 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-block no-underline"><Wordmark tone="inverse"/></Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/90">
              Fresh cow and buffalo milk, Bengali dairy favourites and everyday breakfast essentials — centrally managed and delivered by Dairybuy.
            </p>
            <p className="mt-4 text-xs text-white/80">Kolkata, West Bengal</p>
          </div>
          <div>
            <h2 className="font-sans text-sm font-extrabold tracking-wide text-[#ffd329]">Explore</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {exploreLinks.map((link)=><li key={link.href}><Link href={link.href} className="text-white/90 no-underline hover:text-white hover:underline">{link.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h2 className="font-sans text-sm font-extrabold tracking-wide text-[#ffd329]">Discover</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {usefulLinks.map((link)=><li key={link.href}><Link href={link.href} className="text-white/90 no-underline hover:text-white hover:underline">{link.label}</Link></li>)}
            </ul>
            <DeliveryInfo tone="inverse" className="mt-4"/>
          </div>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-white/25 pt-6 text-xs text-white/85 sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} Dairybuy. Freshness delivered.</p>
          <p>Fresh &amp; honest neighbourhood dairy for Kolkata homes.</p>
        </div>
      </Container>
    </footer>
  );
}
