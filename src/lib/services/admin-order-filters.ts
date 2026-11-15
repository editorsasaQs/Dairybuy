export const ADMIN_ORDER_STATUSES = [
  "draft",
  "pending_confirmation",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "failed",
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export type AdminOrderFilters = {
  deliveryDate?: string;
  deliverySlotId?: string;
  serviceAreaId?: string;
  status?: AdminOrderStatus;
  page: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined): value is string {
  if (!value || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseAdminOrderFilters(
  params: Record<string, string | string[] | undefined>,
): AdminOrderFilters {
  const deliveryDate = first(params["date"]);
  const deliverySlotId = first(params["slot"]);
  const serviceAreaId = first(params["area"]);
  const rawStatus = first(params["status"]);
  const rawPage = Number(first(params["page"]) ?? "1");

  return {
    ...(validDate(deliveryDate) ? { deliveryDate } : {}),
    ...(deliverySlotId && uuidPattern.test(deliverySlotId) ? { deliverySlotId } : {}),
    ...(serviceAreaId && uuidPattern.test(serviceAreaId) ? { serviceAreaId } : {}),
    ...(rawStatus && ADMIN_ORDER_STATUSES.includes(rawStatus as AdminOrderStatus)
      ? { status: rawStatus as AdminOrderStatus }
      : {}),
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
  };
}

export function isValidOrderId(value: string): boolean {
  return uuidPattern.test(value);
}
