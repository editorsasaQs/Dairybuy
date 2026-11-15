import { createFileRoute } from "@tanstack/react-router";
import hello from "@/assets/hello.jpg";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Lacticious" },
      { name: "description", content: "Meet Lacticious: fresh dairy from local vendors and farms delivered to your home in the morning and evening." },
      { property: "og:title", content: "About Lacticious" },
      { property: "og:description", content: "The story behind Lacticious and our fresh dairy deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <section className="bg-ice py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
          <img src={hello} alt="Hello from Lacticious" width={1024} height={1024} className="animate-wiggle rounded-[2rem] border-4 border-background shadow-pop" />
          <div>
            <span className="inline-block rotate-2 rounded-xl bg-coral px-4 py-1 font-display font-bold text-primary-foreground">About us</span>
            <h1 className="mt-4 text-4xl font-bold text-royal-deep md:text-5xl">We're Lacticious!</h1>
            <p className="mt-5 text-lg">
              We started with a simple idea: everyone deserves pure, fresh dairy without the fuss. From creamy milk to
              traditional misti doi and firni, we bring the goodness of local vendors and farms straight to your home.
            </p>
            <p className="mt-4 text-lg">Reusable bottles, morning and evening deliveries — fresh and honest, always. That's the Lacticious way.</p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
