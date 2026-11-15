import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MilkType } from "@/lib/supabase/types";
import {
  findServiceArea,
  getDatabaseServiceability,
  isValidPincode,
} from "@/lib/services/service-area-db-service";
import {
  formatDatabaseCartResult,
  validateAndCalculateDatabaseCart,
} from "@/lib/services/database-cart-service";
import type { ClientCartItemInput } from "@/lib/services/cart-service";
import {
  DELIVERY_TIME_ZONE,
  isDeliveryOrderAllowed,
} from "@/lib/services/delivery-time-service";

type Client = SupabaseClient<Database>;

export type CheckoutValidationInput = {
  addressId: string;
  deliverySlotId: string;
  deliveryDate: string;
};

export type CheckoutValidationResult =
  | { valid: true; summary: Record<string, unknown> }
  | { valid: false; fieldErrors: Record<string, string> };

function invalid(field: string, message: string): CheckoutValidationResult {
  return { valid: false, fieldErrors: { [field]: message } };
}

/**
 * Preview-only checkout validation. Reads authenticated customer data and
 * recalculates all prices from live DB rows. It never writes or reserves data.
 */
export async function validateCheckout(
  supabase: Client,
  customerId: string,
  input: CheckoutValidationInput,
  now: Date = new Date(),
): Promise<CheckoutValidationResult> {
  const { data: address, error: addressError } = await supabase
    .from("customer_addresses")
    .select("id,recipient_name,phone,address_line1,address_line2,landmark,city,state,pincode,service_area_id")
    .eq("id", input.addressId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (addressError) throw new Error("Unable to verify the selected delivery address.");
  if (!address) return invalid("addressId", "Select a saved delivery address.");

  if (!isValidPincode(address.pincode)) {
    return invalid("addressId", "The saved address has an invalid delivery pincode.");
  }

  const serviceability = await getDatabaseServiceability(supabase);
  const area = findServiceArea(serviceability.areas, address.pincode);
  if (!area) {
    return invalid("addressId", "This saved address is outside Dairybuy's active delivery area.");
  }

  const { data: slot, error: slotError } = await supabase
    .from("delivery_slots")
    .select("id,slot_code,label,start_time,end_time,order_cutoff_time,cancellation_deadline_time,is_active")
    .eq("id", input.deliverySlotId)
    .eq("is_active", true)
    .maybeSingle();

  if (slotError) throw new Error("Unable to verify the selected delivery slot.");
  if (!slot) return invalid("deliverySlotId", "Select an active delivery slot.");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate) ||
      !isDeliveryOrderAllowed(input.deliveryDate, slot.order_cutoff_time, now)) {
    return invalid("deliveryDate", "This delivery date is no longer available for the selected slot.");
  }

  const { data: cart, error: cartError } = await supabase
    .from("carts")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "active")
    .maybeSingle();

  if (cartError) throw new Error("Unable to load your saved cart.");
  if (!cart) return invalid("cart", "Your saved cart is empty.");

  const { data: lines, error: linesError } = await supabase
    .from("cart_items")
    .select("id,product_variant_id,vendor_id,milk_type,quantity,quantity_litres")
    .eq("cart_id", cart.id);

  if (linesError) throw new Error("Unable to load your saved cart items.");
  if (!lines?.length) return invalid("cart", "Your saved cart is empty.");

  const variantIds = [...new Set(lines.map((line) => line.product_variant_id))];
  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id,product_id,unit_quantity")
    .in("id", variantIds);

  if (variantError) throw new Error("Unable to verify saved cart products.");
  const variantById = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  if (variantById.size !== variantIds.length) {
    return invalid("cart", "One or more saved products are no longer available.");
  }

  const productIds = [...new Set((variants ?? []).map((variant) => variant.product_id))];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id,product_type")
    .in("id", productIds);

  if (productError) throw new Error("Unable to verify saved cart products.");
  const productById = new Map((products ?? []).map((product) => [product.id, product]));
  if (productById.size !== productIds.length) {
    return invalid("cart", "One or more saved products are no longer available.");
  }

  const cartInput: ClientCartItemInput[] = [];
  for (const line of lines) {
    const variant = variantById.get(line.product_variant_id);
    const product = variant ? productById.get(variant.product_id) : undefined;
    if (!variant || !product) return invalid("cart", "One or more saved products are no longer available.");

    const isMilk = product.product_type === "standard_milk" || product.product_type === "canteen_milk";
    if (isMilk && line.milk_type !== "cow" && line.milk_type !== "buffalo" && line.milk_type !== "canteen") {
      return invalid("cart", "A saved milk selection is invalid. Please update your cart.");
    }

    cartInput.push({
      key: line.id,
      productVariantId: line.product_variant_id,
      vendorId: line.vendor_id,
      milkType: line.milk_type as MilkType | null,
      ...(isMilk ? { litres: Number(line.quantity_litres ?? variant.unit_quantity) } : {}),
      quantity: line.quantity,
    });
  }

  const cartResult = await validateAndCalculateDatabaseCart(supabase, cartInput);
  if (!cartResult.isValid) {
    return {
      valid: false,
      fieldErrors: { cart: cartResult.errors.join(" ") || "Your cart needs to be updated." },
    };
  }

  const formatted = formatDatabaseCartResult(cartResult);

  return {
    valid: true,
    summary: {
      customerId,
      address: {
        id: address.id,
        recipientName: address.recipient_name,
        phone: address.phone,
        addressLine1: address.address_line1,
        addressLine2: address.address_line2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        serviceAreaId: area.id,
        serviceAreaName: area.name,
      },
      delivery: {
        date: input.deliveryDate,
        slotId: slot.id,
        slotCode: slot.slot_code,
        label: slot.label,
        startTime: slot.start_time,
        endTime: slot.end_time,
        timezone: DELIVERY_TIME_ZONE,
      },
      cart: formatted,
      // CSV/vendor prices already include their product delivery component.
      // There is no additional generic delivery fee at checkout.
      deliveryFeePaise: 0,
      totalPaise: formatted.totalPaise,
    },
  };
}
