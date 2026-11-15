export type OrderDeliveryAddressSnapshot = {
  schema_version: 1;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  service_area_id: string;
};

export function parseOrderDeliveryAddressSnapshot(value: unknown): OrderDeliveryAddressSnapshot | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const requiredStringFields = [
    "recipient_name",
    "phone",
    "address_line1",
    "city",
    "state",
    "pincode",
    "service_area_id",
  ] as const;

  if (record["schema_version"] !== 1) return null;
  if (requiredStringFields.some((field) => typeof record[field] !== "string" || !(record[field] as string).trim())) {
    return null;
  }
  if (record["address_line2"] !== null && typeof record["address_line2"] !== "string") return null;
  if (record["landmark"] !== null && typeof record["landmark"] !== "string") return null;

  return {
    schema_version: 1,
    recipient_name: record["recipient_name"] as string,
    phone: record["phone"] as string,
    address_line1: record["address_line1"] as string,
    address_line2: record["address_line2"] as string | null,
    landmark: record["landmark"] as string | null,
    city: record["city"] as string,
    state: record["state"] as string,
    pincode: record["pincode"] as string,
    service_area_id: record["service_area_id"] as string,
  };
}
