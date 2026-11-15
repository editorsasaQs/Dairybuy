/**
 * Dairybuy pricing and quantity rules sourced from the approved November 10 CSVs.
 * Product prices include their own delivery component; no extra order-level fee applies.
 */
export const DELIVERY_FEE_INR = 0;
export const MIN_MILK_LITRES = 0.5;
export const MAX_MILK_LITRES = 10;
export const MILK_QUANTITY_STEP_LITRES = 0.5;

/** Database reference variants. Multi-litre selections use the 1 L reference variant. */
export const MILK_SIZES = [
  { id: "500ml", litres: 0.5, label: "500 ml" },
  { id: "1l", litres: 1, label: "1 L" },
] as const;
export type MilkSizeId = (typeof MILK_SIZES)[number]["id"];

/** Customer-selectable delivery volumes: 500 ml through 10 L in 500 ml steps. */
export const MILK_VOLUME_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const litres = (index + 1) * MILK_QUANTITY_STEP_LITRES;
  return {
    litres,
    label: litres < 1 ? String(Math.round(litres * 1000)) + " ml" : String(Number(litres.toFixed(1))) + " L",
  };
});

export function formatInr(amount: number): string {
  return `₹${amount}`;
}

/** Delivery components from the approved CSV are already included in each displayed final price. */
export function deliveryFeeLabel(): string {
  return "Included in displayed prices";
}
