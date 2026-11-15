import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  findServiceArea,
  getDatabaseServiceability,
  isValidPincode,
} from "@/lib/services/service-area-db-service";

type Client = SupabaseClient<Database>;

export type AddressInput = {
  addressType: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
};

export function parseAddressInput(value: unknown): AddressInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const string = (key: string, max: number): string | null => {
    const raw = input[key];
    if (typeof raw !== "string") return null;
    const clean = raw.trim();
    return clean.length > 0 && clean.length <= max ? clean : null;
  };
  const recipientName = string("recipientName", 120);
  const phoneRaw = string("phone", 16);
  const addressLine1 = string("addressLine1", 240);
  const pincodeRaw = string("pincode", 6);
  const addressType = string("addressType", 30) ?? "Home";
  const city = string("city", 100) ?? "Kolkata";
  const state = string("state", 100) ?? "West Bengal";
  if (!recipientName || !phoneRaw || !addressLine1 || !pincodeRaw) return null;
  const phone = phoneRaw.replace(/[\s()-]/g, "");
  if (!/^\+?[1-9]\d{7,14}$/.test(phone) || !isValidPincode(pincodeRaw)) return null;
  const optional = (key: string, max: number) => {
    const raw = input[key];
    if (raw == null || raw === "") return null;
    if (typeof raw !== "string" || raw.trim().length > max) return undefined;
    return raw.trim();
  };
  const addressLine2 = optional("addressLine2", 240);
  const landmark = optional("landmark", 160);
  if (addressLine2 === undefined || landmark === undefined) return null;
  return {
    addressType,
    recipientName,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode: pincodeRaw.trim(),
  };
}

export async function resolveServiceAreaId(client: Client, pincode: string): Promise<string | null> {
  if (!isValidPincode(pincode)) return null;
  const catalogue = await getDatabaseServiceability(client);
  return findServiceArea(catalogue.areas, pincode)?.id ?? null;
}
