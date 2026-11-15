import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BagProvider } from "@/components/bag/BagContext";
import { BagDrawer } from "@/components/bag/BagDrawer";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

// Self-hosted variable fonts (OFL-1.1), subset: latin. One file each, so no
// per-weight downloads and no build-time dependency on fonts.googleapis.com.
const fraunces = localFont({
  src: "./fonts/fraunces-latin-wght-normal.woff2",
  variable: "--font-fraunces",
  weight: "400 800",
  display: "swap",
});

const sora = localFont({
  src: "./fonts/sora-latin-wght-normal.woff2",
  variable: "--font-sora",
  weight: "300 700",
  display: "swap",
});

const siteTitle = "Dairybuy — Fresh Dairy, Delivered Daily";
const siteDescription =
  "Shop fresh milk, curd, misti doi, paneer, ghee and everyday dairy essentials delivered daily with Dairybuy.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  applicationName: "Dairybuy",
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f7ff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sora.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <BagProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <BagDrawer />
        </BagProvider>
      </body>
    </html>
  );
}
