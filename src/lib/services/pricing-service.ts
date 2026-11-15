/**
 * Dairybuy authoritative pricing helpers.
 * All amounts are integer paise. CSV final per-delivery prices already include
 * the applicable product/vendor delivery component; never add a generic fee.
 */

export const PAISE_PER_RUPEE = 100;
export const DELIVERY_FEE_PAISE = 0;
export const SUBSCRIPTION_30_DAY_DISCOUNT_PAISE = 6000;
export const MIN_MILK_LITRES = 0.5;
export const MAX_MILK_LITRES = 10;
export const MILK_QUANTITY_STEP_LITRES = 0.5;

export function paiseToRupees(paise: number): number {
  return Number((paise / PAISE_PER_RUPEE).toFixed(2));
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function formatPaise(paise: number): string {
  const rupees = paiseToRupees(paise);
  return Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;
}

export type MilkPlanPricing = {
  pricePerDeliveryPaise: number;
  plan7DayPaise: number;
  plan30DayPaise: number;
  deliveryFeePaise: number;
  totalPerDeliveryPaise: number;
};

export function validateProductPriceComponents(
  purchasePaise: number,
  componentPaise: number,
  finalPaise: number,
): boolean {
  return purchasePaise + componentPaise === finalPaise;
}

export function isSupportedMilkLitres(litres: number): boolean {
  return Number.isFinite(litres) &&
    litres >= MIN_MILK_LITRES &&
    litres <= MAX_MILK_LITRES &&
    Number.isInteger(litres * 2);
}

/**
 * Calculates one selected milk volume from the CSV's base selling prices and
 * delivery components. 500 ml uses its own component; every volume above 500 ml
 * uses one 1 L delivery component for the complete delivery run.
 */
export function calculateMilkDeliveryPricePaise(input: {
  litres: number;
  price500mlPaise: number;
  delivery500mlPaise: number;
  price1lPaise: number;
  delivery1lPaise: number;
}): number | null {
  const { litres, price500mlPaise, delivery500mlPaise, price1lPaise, delivery1lPaise } = input;
  if (!isSupportedMilkLitres(litres)) return null;
  if ([price500mlPaise, delivery500mlPaise, price1lPaise, delivery1lPaise]
    .some((value) => !Number.isSafeInteger(value) || value < 0)) return null;

  if (litres === 0.5) return price500mlPaise + delivery500mlPaise;

  const wholeLitres = Math.floor(litres);
  const hasHalfLitre = litres - wholeLitres === 0.5;
  return wholeLitres * price1lPaise +
    (hasHalfLitre ? price500mlPaise : 0) +
    delivery1lPaise;
}

/** Order lines already contain their complete customer-facing price. */
export function calculateOrderTotals(
  items: readonly { unitPricePaise: number; quantity: number }[],
): { subtotalPaise: number; deliveryFeePaise: number; totalPaise: number } {
  const subtotalPaise = items.reduce(
    (sum, item) => sum + item.unitPricePaise * item.quantity,
    0,
  );
  return { subtotalPaise, deliveryFeePaise: 0, totalPaise: subtotalPaise };
}

/** Complete basket calculation: the ₹60 monthly discount is applied exactly once. */
export function calculateSubscriptionBasketTotals(
  items: readonly { pricePerDeliveryPaise: number; quantity: number }[],
  days: 7 | 30,
): { subtotalPaise: number; discountPaise: number; grandTotalPaise: number } {
  const subtotalPaise = items.reduce(
    (sum, item) => sum + item.pricePerDeliveryPaise * item.quantity * days,
    0,
  );
  const discountPaise = days === 30 && subtotalPaise > 0
    ? SUBSCRIPTION_30_DAY_DISCOUNT_PAISE
    : 0;
  return {
    subtotalPaise,
    discountPaise,
    grandTotalPaise: Math.max(0, subtotalPaise - discountPaise),
  };
}
