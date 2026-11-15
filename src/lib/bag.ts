import {
  canteenMilkVendor,
  isOrderableMilkQuantity,
  isSelectableMilkOption,
  milkVendors,
  type MilkType,
  type MilkVendor,
} from "@/lib/milk";

export type BagItemKind = "catalogue" | "milk";

export type BagItem = {
  key: string;
  kind: BagItemKind;
  productId: string;
  productVariantId: string;
  name: string;
  image: string;
  detail: string;
  vendorName?: string;
  milkType?: MilkType;
  litres?: number;
  unitPriceInr: number | null;
  quantity: number;
};

export function catalogueBagKey(productId: string, variantId: string): string {
  return `catalogue:${productId}:${variantId}`;
}

export type AddBagItemInput = Omit<BagItem, "quantity"> & {
  quantity?: number;
};

const MILK_PRODUCT_ID = /^milk-([a-z0-9-]+)-(cow|buffalo|canteen)$/;

export function milkProductId(vendorId: string, type: MilkType): string {
  return `milk-${vendorId}-${type}`;
}

export function parseMilkProductId(
  productId: string,
): { vendorId: string; type: MilkType } | null {
  const match = MILK_PRODUCT_ID.exec(productId);
  if (!match) {
    return null;
  }
  const vendorId = match[1];
  const type = match[2];
  if (
    vendorId === undefined ||
    (type !== "cow" && type !== "buffalo" && type !== "canteen")
  ) {
    return null;
  }
  return { vendorId, type: type as MilkType };
}

/**
 * Business-rule gate for anything entering the bag.
 * - Standard milk lines need a VERIFIED vendor + milk type mapping and a supported volume from 500 ml to 10 L in 500 ml increments. Provisional mappings and disabled vendors are rejected.
 * - Canteen milk requires Canteen Milk Centre vendor and supported 500 ml–10 L volume in 500 ml increments.
 * - Catalogue lines must be non-milk products; vendor selection is milk-only.
 */
export function isAddableBagItem(
  input: AddBagItemInput,
  vendors: readonly MilkVendor[] = milkVendors,
): boolean {
  if (input.key.length === 0 || typeof input.productVariantId !== "string" || input.productVariantId.trim().length === 0) {
    return false;
  }
  if (
    input.quantity !== undefined &&
    (!Number.isInteger(input.quantity) || input.quantity < 1)
  ) {
    return false;
  }

  if (input.kind === "milk") {
    const parsed = parseMilkProductId(input.productId);
    if (!parsed) {
      return false;
    }

    if (parsed.type === "canteen") {
      return (
        parsed.vendorId === canteenMilkVendor.id &&
        input.milkType === "canteen" &&
        canteenMilkVendor.orderable === true &&
        input.litres !== undefined &&
        isOrderableMilkQuantity(input.litres)
      );
    }

    return (
      input.milkType === parsed.type &&
      isSelectableMilkOption(parsed.vendorId, parsed.type, vendors) &&
      input.litres !== undefined &&
      isOrderableMilkQuantity(input.litres)
    );
  }

  // Confirmed catalogue product IDs are stable slugs (e.g. ghee-red-cow).
  const isDatabaseProductId =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.productId) &&
    !input.productId.startsWith("milk-") &&
    input.productId !== "milk";
  return (
    isDatabaseProductId &&
    input.milkType === undefined &&
    input.litres === undefined &&
    input.vendorName === undefined
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBagItem(value: unknown): BagItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const key = value["key"];
  const kind = value["kind"];
  const productId = value["productId"];
  const productVariantId = value["productVariantId"];
  const name = value["name"];
  const image = value["image"];
  const detail = value["detail"];
  const unitPriceInr = value["unitPriceInr"];
  const quantity = value["quantity"];
  const vendorName = value["vendorName"];
  const milkType = value["milkType"];
  const litres = value["litres"];

  if (
    typeof key !== "string" ||
    (kind !== "catalogue" && kind !== "milk") ||
    typeof productId !== "string" ||
    typeof productVariantId !== "string" ||
    typeof name !== "string" ||
    typeof image !== "string" ||
    typeof detail !== "string" ||
    typeof quantity !== "number" ||
    !(unitPriceInr === null || typeof unitPriceInr === "number")
  ) {
    return null;
  }

  const item: BagItem = {
    key,
    kind,
    productId,
    productVariantId,
    name,
    image,
    detail,
    unitPriceInr,
    quantity,
  };
  if (typeof vendorName === "string") {
    item.vendorName = vendorName;
  }
  if (milkType === "cow" || milkType === "buffalo" || milkType === "canteen") {
    item.milkType = milkType as MilkType;
  }
  if (typeof litres === "number") {
    item.litres = litres;
  }
  return item;
}

/**
 * Re-validates a bag read back from storage. Anything that breaks a current
 * business rule is dropped, e.g. a sub-500 ml milk line saved before the
 * minimum was enforced, or a line for a vendor that is not selectable.
 */
export function sanitizeStoredBagItems(
  raw: unknown,
  vendors: readonly MilkVendor[] = milkVendors,
): BagItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: BagItem[] = [];
  for (const entry of raw as unknown[]) {
    const item = toBagItem(entry);
    if (item !== null && isAddableBagItem(item, vendors)) {
      const normalized = item.kind === "catalogue"
        ? { ...item, key: catalogueBagKey(item.productId, item.productVariantId) }
        : item;
      items.push(normalized);
    }
  }
  return items;
}

/**
 * Merge a browser guest bag with the authenticated server snapshot.
 * Server metadata wins for matching lines; quantities are capped at the DB limit.
 */
export function mergeBagItems(
  guestItems: readonly BagItem[],
  accountItems: readonly BagItem[],
): BagItem[] {
  const merged = new Map(accountItems.map((item) => [item.key, item]));
  for (const guest of guestItems) {
    const existing = merged.get(guest.key);
    if (!existing) {
      merged.set(guest.key, guest);
      continue;
    }
    if (existing.productVariantId !== guest.productVariantId ||
        existing.productId !== guest.productId) {
      // A key collision with a different variant must not overwrite the
      // authenticated account line. The server snapshot remains authoritative.
      continue;
    }
    merged.set(guest.key, {
      ...existing,
      image: existing.image || guest.image,
      quantity: Math.min(100, existing.quantity + guest.quantity),
    });
  }
  return [...merged.values()];
}
