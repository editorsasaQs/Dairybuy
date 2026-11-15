import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const customerSources = walk(join(root, "src"))
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => ({
    path: relative(root, file),
    text: readFileSync(file, "utf8"),
  }));

describe("customer-facing copy rules", () => {
  it("scans a meaningful number of source files", () => {
    expect(customerSources.length).toBeGreaterThan(15);
  });

  it.each([
    /become a vendor/i,
    /vendor partner/i,
    /partner with dairybuy/i,
    /vendor onboarding/i,
    /partner details/i,
    /grow with dairybuy/i,
    /marketplace/i,
    /kolkata partner/i,
  ])("has no marketplace messaging matching %s", (pattern) => {
    const hits = customerSources.filter((f) => pattern.test(f.text));
    expect(hits.map((f) => f.path)).toEqual([]);
  });

  it.each([/calculated by address/i, /free delivery/i, /delivery:?\s*free/i, />\s*FREE\s*</, /"FREE"/])(
    "does not show address-calculated or free delivery (%s)",
    (pattern) => {
      const hits = customerSources.filter((f) => pattern.test(f.text));
      expect(hits.map((f) => f.path)).toEqual([]);
    },
  );

  it.each([/lacticious/i, /lactitius/i])("never uses the old brand %s", (pattern) => {
    const hits = customerSources.filter((f) => pattern.test(f.text));
    expect(hits.map((f) => f.path)).toEqual([]);
  });

  it("does not advertise bulk, custom-litre or 1.5 L–9 L milk quantities", () => {
    for (const pattern of [/custom litres/i, /up to custom/i, /custom quantity/i, /\b50 ?L\b/, /\b9 ?L\b/]) {
      const hits = customerSources.filter((f) => pattern.test(f.text));
      expect(hits.map((f) => f.path)).toEqual([]);
    }
  });
});

describe("fee and slots come from shared business config only", () => {
  const others = customerSources.filter(
    (f) => f.path !== join("src", "lib", "business.ts"),
  );

  it("does not hardcode the ₹4 delivery fee outside src/lib/business.ts", () => {
    const hits = others.filter((f) => /₹\s?4(?!\d)/.test(f.text));
    expect(hits.map((f) => f.path)).toEqual([]);
  });

  it("does not hardcode the delivery windows outside src/lib/business.ts", () => {
    const hits = others.filter((f) =>
      /9 ?AM|12 ?PM|4 ?PM|7 ?PM/.test(f.text),
    );
    expect(hits.map((f) => f.path)).toEqual([]);
  });

  it("shows the shared delivery info in the bag, footer, milk page and About", () => {
    for (const file of [
      "src/components/bag/BagDrawer.tsx",
      "src/components/layout/SiteFooter.tsx",
      "src/components/milk/MilkVendorSelector.tsx",
      "src/app/about/page.tsx",
    ]) {
      expect(readFileSync(join(root, file), "utf8")).toContain("DeliveryInfo");
    }
  });

  it("shows the delivery fee label in the bag", () => {
    const bag = readFileSync(join(root, "src/components/bag/BagDrawer.tsx"), "utf8");
    expect(bag).toContain("deliveryFeeLabel()");
  });

  it("offers no slot picker (slots are informational only)", () => {
    const info = readFileSync(
      join(root, "src/components/delivery/DeliveryInfo.tsx"),
      "utf8",
    );
    for (const needle of ["<select", "<input", "<button", 'type="radio"']) {
      expect(info).not.toContain(needle);
    }
  });
});

describe("private archives stay out of public/", () => {
  const publicDir = join(root, "public");
  const files = existsSync(publicDir) ? walk(publicDir) : [];

  it("has a public directory with images", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no archives or backups", () => {
    const bad = files.filter((file) =>
      /\.(zip|tar|tgz|gz|7z|rar|bak|bun|lock)$/i.test(file),
    );
    expect(bad.map((f) => relative(root, f))).toEqual([]);
  });

  it("contains no assets/aistudio directory", () => {
    expect(existsSync(join(publicDir, "assets", "aistudio"))).toBe(false);
  });

  it("keeps all 14 original JPG assets", () => {
    const jpgs = files.filter((file) => /\.jpg$/i.test(file));
    expect(jpgs).toHaveLength(14);
  });
});
