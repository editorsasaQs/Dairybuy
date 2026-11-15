"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useBag } from "@/components/bag/BagContext";
import { Container } from "@/components/brand/Container";
import { Wordmark } from "@/components/brand/Wordmark";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Catalogue", href: "/products" },
  { label: "Fresh Milk", href: "/milk" },
  { label: "About", href: "/about" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { totalCount, openBag } = useBag();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#dff5fc] bg-white/95 backdrop-blur-md">
      <Container className="flex min-h-[5.5rem] items-center justify-between gap-4 py-3">
        <Link href="/" onClick={() => setMobileMenuOpen(false)} className="shrink-0 whitespace-nowrap no-underline">
          <Wordmark />
        </Link>
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-2 text-sm font-bold no-underline transition-colors ${active ? "bg-[#dff5fc] text-[#284967]" : "text-[#526b80] hover:bg-[#dff5fc]"}`}>{item.label}</Link>;
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/products" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ffd329] px-5 text-sm font-extrabold text-[#284967] no-underline shadow-[0_4px_0_#284967] transition-transform hover:-translate-y-0.5">
            Order now
          </Link>
          <button type="button" onClick={openBag} aria-label={totalCount ? `Open bag, ${totalCount} items` : "Open bag"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#dff5fc] bg-white text-[#284967] hover:bg-[#dff5fc]">
            <ShoppingBag className="h-5 w-5" aria-hidden="true"/>
          </button>
          <Link href="/login" aria-label="Login or open account" className="hidden h-11 w-11 items-center justify-center rounded-full border-2 border-[#dff5fc] bg-white text-[#284967] hover:bg-[#dff5fc] sm:inline-flex">
            <UserRound className="h-5 w-5" aria-hidden="true"/>
          </Link>
          <button type="button" onClick={() => setMobileMenuOpen((prev) => !prev)} aria-expanded={mobileMenuOpen}
            aria-controls="mobile-primary-nav" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#dff5fc] bg-white text-[#284967] md:hidden">
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true"/> : <Menu className="h-5 w-5" aria-hidden="true"/>}
          </button>
        </div>
      </Container>
      {mobileMenuOpen && <nav id="mobile-primary-nav" aria-label="Mobile navigation" className="border-t-2 border-[#dff5fc] bg-white md:hidden">
        <Container className="flex flex-col py-3">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-12 items-center rounded-2xl px-4 text-base font-bold no-underline ${active ? "bg-[#dff5fc] text-[#284967]" : "text-[#526b80]"}`}>{item.label}</Link>;
          })}
          <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center px-4 font-bold text-[#284967] no-underline">My account</Link>
        </Container>
      </nav>}
    </header>
  );
}
