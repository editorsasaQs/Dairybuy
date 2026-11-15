import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request, secret: string): boolean {
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function kolkataDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
}

export async function GET(request: Request) {
  const secret = process.env["CRON_SECRET"];
  const url = process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!secret || !url || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: "Subscription scheduler is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = createClient<Database>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const deliveryDate = kolkataDate();
    const { data, error } = await supabase.rpc("generate_subscription_deliveries" as never, { p_delivery_date: deliveryDate } as never);
    if (error) {
      console.error("[cron/subscriptions] Daily delivery generation failed:", error.code, error.message);
      return NextResponse.json({ success: false, deliveryDate, error: "Daily subscription delivery generation failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: true, deliveryDate, result: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron/subscriptions] Scheduler execution failed:", error);
    return NextResponse.json({ success: false, error: "Daily subscription delivery generation failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
