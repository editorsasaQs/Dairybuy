import { NextResponse } from "next/server";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient, isServerSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expectedCodes = ["22023", "23514", "23505", "42501", "P0002"];

function failure(error: { code?: string; message: string }, fallback: string) {
  const expected = expectedCodes.includes(error.code ?? "");
  return NextResponse.json(
    { success: false, error: expected ? error.message : fallback },
    { status: expected ? 422 : 503, headers },
  );
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ success: false, error: "Operations service unavailable." }, { status: 503, headers });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
    const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const admin = !roleError && (roles ?? []).some((row) => isAdminOrOwner(row.role));
    if (!admin) return NextResponse.json({ success: false, error: "Owner/admin access required." }, { status: 403, headers });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400, headers }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400, headers });
    const input = body as Record<string, unknown>;
    const deliveryId = input["deliveryId"];
    const action = input["action"];
    if (typeof deliveryId !== "string" || !uuidPattern.test(deliveryId) || typeof action !== "string") {
      return NextResponse.json({ success: false, error: "A valid delivery and action are required." }, { status: 400, headers });
    }

    if (action === "start" || action === "complete" || action === "record_cod" || action === "verify_cod" || action === "reject_cod" || action === "resolve_cod") {
      const { data: delivery, error: deliveryError } = await supabase.from("subscription_deliveries")
        .select("order_id,status").eq("id", deliveryId).maybeSingle();
      if (deliveryError || !delivery?.order_id) return NextResponse.json({ success: false, error: "Subscription delivery order not found." }, { status: 404, headers });

      if (action === "start") {
        const { data, error } = await supabase.rpc("start_subscription_delivery" as never, { p_delivery_id: deliveryId } as never);
        if (error) return failure(error, "Delivery could not be dispatched.");
        return NextResponse.json({ success: true, data }, { headers });
      }

      if (action === "complete") {
        if (delivery.status === "scheduled" || delivery.status === "assigned") {
          const { error: startError } = await supabase.rpc("start_subscription_delivery" as never, { p_delivery_id: deliveryId } as never);
          if (startError) return failure(startError, "Delivery could not be prepared for completion.");
        }
        const { data, error } = await supabase.rpc("complete_subscription_delivery" as never, { p_delivery_id: deliveryId } as never);
        if (error) return failure(error, "Delivery could not be marked delivered.");
        return NextResponse.json({ success: true, data }, { headers });
      }

      if (action === "record_cod") {
        const amountRupees = Number(input["amountRupees"]);
        const amountPaise = Math.round(amountRupees * 100);
        if (!Number.isFinite(amountRupees) || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
          return NextResponse.json({ success: false, error: "Enter the positive cash amount received in rupees." }, { status: 400, headers });
        }
        if (delivery.status !== "delivered") return NextResponse.json({ success: false, error: "Cash can be recorded only after the delivery is marked delivered." }, { status: 422, headers });
        const { data, error } = await supabase.rpc("record_cod_cash_collection" as never, {
          p_order_id: delivery.order_id,
          p_amount_collected_paise: amountPaise,
          p_receipt_reference: typeof input["receiptReference"] === "string" ? input["receiptReference"].slice(0, 120) : null,
          p_collection_notes: "Subscription delivery cash recorded by owner/admin",
        } as never);
        if (error) return failure(error, "Cash collection could not be recorded.");
        return NextResponse.json({ success: true, data }, { headers });
      }

      if (action === "verify_cod" || action === "reject_cod") {
        const decision = action === "verify_cod" ? "verify" : "reject";
        const note = typeof input["reason"] === "string" ? input["reason"].trim() : "";
        if (decision === "reject" && (note.length < 5 || note.length > 500)) {
          return NextResponse.json({ success: false, error: "A rejection reason of 5–500 characters is required." }, { status: 400, headers });
        }
        const { data, error } = await supabase.rpc("review_cod_cash_collection" as never, {
          p_order_id: delivery.order_id, p_decision: decision, p_note: decision === "reject" ? note : null,
        } as never);
        if (error) return failure(error, "COD collection review failed.");
        return NextResponse.json({ success: true, data }, { headers });
      }

      if (action === "resolve_cod") {
        const amountRupees = Number(input["amountRupees"]);
        const amountPaise = Math.round(amountRupees * 100);
        const reason = typeof input["reason"] === "string" ? input["reason"].trim() : "";
        const evidence = typeof input["evidenceReference"] === "string" ? input["evidenceReference"].trim() : "";
        if (!Number.isFinite(amountRupees) || !Number.isSafeInteger(amountPaise) || amountPaise <= 0 || reason.length < 5 || reason.length > 500 || evidence.length > 200) {
          return NextResponse.json({ success: false, error: "Enter a valid corrected cash amount and a 5–500 character reason." }, { status: 400, headers });
        }
        const { data, error } = await supabase.rpc("resolve_cod_collection_discrepancy" as never, {
          p_order_id: delivery.order_id, p_corrected_amount_paise: amountPaise,
          p_reason: reason, p_evidence_reference: evidence || null,
        } as never);
        if (error) return failure(error, "COD discrepancy could not be resolved.");
        return NextResponse.json({ success: true, data }, { headers });
      }
    }

    if (action === "fail") {
      const reason = typeof input["reason"] === "string" ? input["reason"].trim() : "";
      if (reason.length < 1 || reason.length > 500) return NextResponse.json({ success: false, error: "A failure reason of 1–500 characters is required." }, { status: 400, headers });
      const { data, error } = await supabase.rpc("fail_subscription_delivery" as never, { p_delivery_id: deliveryId, p_reason: reason } as never);
      if (error) return failure(error, "Delivery failure could not be recorded.");
      return NextResponse.json({ success: true, data }, { headers });
    }

    return NextResponse.json({ success: false, error: "Unsupported admin delivery action." }, { status: 400, headers });
  } catch (error) {
    console.error("[api/admin/subscriptions] POST failed:", error);
    return NextResponse.json({ success: false, error: "Delivery operation failed." }, { status: 503, headers });
  }
}
