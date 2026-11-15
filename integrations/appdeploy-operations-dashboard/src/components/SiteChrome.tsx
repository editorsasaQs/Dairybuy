import { Link } from "@tanstack/react-router";

const nav: [string, string][] = [
  ["About Us", "/about"],
  ["Products", "/#products"],
  ["Why Us", "/#why"],
  ["Vendors", "/#vendors"],
  ["Contact", "/#contact"],
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ice bg-background text-royal-deep">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-logo text-3xl text-royal">Lacticious</Link>
        <nav className="hidden gap-7 font-semibold md:flex">
          {nav.map(([l, h]) =>
            h === "/about" ? (
              <Link key={h} to="/about" className="transition hover:text-berry">{l}</Link>
            ) : (
              <a key={h} href={h} className="transition hover:text-berry">{l}</a>
            ),
          )}
        </nav>
        <a href="/#order" className="rounded-full bg-sun px-5 py-2 font-bold text-royal-deep transition hover:scale-105">Order now</a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-royal py-8 text-center text-primary-foreground">
      <span className="font-logo text-2xl">Lacticious</span>
      <p className="mt-2 text-sm">© 2026 Lacticious. Freshness delivered.</p>
    </footer>
  );
}
