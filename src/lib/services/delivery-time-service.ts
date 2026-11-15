/**
 * Server-side Dairybuy delivery clock rules.
 *
 * Keep this module in server-only call paths. Business dates and clock times
 * are always interpreted in Asia/Kolkata, regardless of the host's timezone.
 */
export const DELIVERY_TIME_ZONE = "Asia/Kolkata";

type KolkataClock = {
  date: string;
  secondsSinceMidnight: number;
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DELIVERY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getKolkataClock(now: Date): KolkataClock {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("A valid clock instant is required.");
  }

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );

  const year = parts["year"];
  const month = parts["month"];
  const day = parts["day"];
  const hour = Number(parts["hour"]);
  const minute = Number(parts["minute"]);
  const second = Number(parts["second"]);

  if (!year || !month || !day || !Number.isInteger(hour) ||
      !Number.isInteger(minute) || !Number.isInteger(second)) {
    throw new Error("Unable to resolve the Asia/Kolkata clock.");
  }

  return {
    date: `${year}-${month}-${day}`,
    secondsSinceMidnight: hour * 3600 + minute * 60 + second,
  };
}

function parseDateKey(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dateParts = value.split("-").map(Number);
  const year = dateParts[0] ?? Number.NaN;
  const month = dateParts[1] ?? Number.NaN;
  const day = dateParts[2] ?? Number.NaN;
  if (year < 1000 || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return value;
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return hour * 3600 + Number(match[2]) * 60 + Number(match[3] ?? "0");
}

/**
 * A same-day order must be placed strictly before its DB-configured cutoff.
 * Future delivery dates remain eligible; past dates are always rejected.
 */
export function isDeliveryOrderAllowed(
  deliveryDate: string,
  orderCutoffTime: string,
  now: Date = new Date(),
): boolean {
  const dateKey = parseDateKey(deliveryDate);
  const cutoffSeconds = parseTime(orderCutoffTime);
  if (!dateKey || cutoffSeconds === null) return false;

  const clock = getKolkataClock(now);
  if (dateKey < clock.date) return false;
  if (dateKey > clock.date) return true;
  return clock.secondsSinceMidnight < cutoffSeconds;
}

/**
 * Cancellation is allowed through the configured deadline, inclusive.
 * Future delivery dates remain cancellable; past delivery dates do not.
 */
export function isDeliveryCancellationAllowed(
  deliveryDate: string,
  cancellationDeadlineTime: string,
  now: Date = new Date(),
): boolean {
  const dateKey = parseDateKey(deliveryDate);
  const deadlineSeconds = parseTime(cancellationDeadlineTime);
  if (!dateKey || deadlineSeconds === null) return false;

  const clock = getKolkataClock(now);
  if (dateKey < clock.date) return false;
  if (dateKey > clock.date) return true;
  return clock.secondsSinceMidnight <= deadlineSeconds;
}
