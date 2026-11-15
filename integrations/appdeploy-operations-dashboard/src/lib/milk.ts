export type MilkType = "cow" | "buffalo";

export type MilkOption = { type: MilkType; mrp: number; off: number; price: number };
export type MilkVendor = { id: string; name: string; options: MilkOption[] };

export const milkVendors: MilkVendor[] = [
  { id: "healthy-haryana", name: "Healthy Haryana Milk", options: [
    { type: "cow", mrp: 100, off: 14, price: 88 },
    { type: "buffalo", mrp: 110, off: 16, price: 95 },
  ] },
  { id: "vip-pure", name: "VIP Pure Milk", options: [
    { type: "cow", mrp: 95, off: 12, price: 85 },
    { type: "buffalo", mrp: 115, off: 15, price: 100 },
  ] },
];

/** Preset quantities in litres: 500 ml up to 9 L. */
export const presetLitres = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9];

export const formatQty = (l: number) => (l < 1 ? `${Math.round(l * 1000)} ml` : `${l} L`);

/** Price for a given quantity, rounded to whole rupees. */
export const priceFor = (perLitre: number, litres: number) => Math.round(perLitre * litres);
