// Mongike webhook receiver - payload: { order_id, payment_status, reference, amount, metadata }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveOrderId(payload: Record<string, any>) {
  return pickFirstString(
    payload.order_id,
    payload.orderId,
    payload.merchant_order_id,
    payload.reference_id,
    payload?.data?.order_id,
    payload?.data?.orderId,
    payload?.data?.merchant_order_id,
    payload?.metadata?.order_id,
    payload?.metadata?.donation_id,
  );
}

function resolveReference(payload: Record<string, any>) {
  const reference = pickFirstString(
    payload.reference,
    payload.gateway_ref,
    payload.transaction_id,
    payload.transid,
    payload.receipt,
    payload?.data?.reference,
    payload?.data?.gateway_ref,
    payload?.data?.transaction_id,
  );
  return reference || null;
}

function normalizePaymentStatus(payload: Record<string, any>) {
  const rawStatus = pickFirstString(
    payload.payment_status,
    payload.status,
    payload.transaction_status,
    payload.state,
    payload.result,
    payload?.data?.payment_status,
    payload?.data?.status,
    payload?.data?.transaction_status,
  ).toUpperCase();

  if (!rawStatus) return "COMPLETED";
  if (["SUCCESS", "SUCCEEDED", "COMPLETED", "COMPLETE", "PAID", "APPROVED"].includes(rawStatus)) return "COMPLETED";
  if (["FAILED", "FAIL", "DECLINED", "CANCELLED", "CANCELED", "REJECTED", "ERROR"].includes(rawStatus)) return "FAILED";
  if (["PENDING", "PROCESSING", "INITIATED", "QUEUED"].includes(rawStatus)) return "PENDING";
  return rawStatus;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));
  const raw = await req.text();
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {};
  }

  await supabase.from("webhook_logs").insert({ headers, payload });

  console.log(JSON.stringify({
    event: "mongike_webhook_received",
    headers,
    payload,
  }));

  const requireApiKey = (Deno.env.get("MONGIKE_REQUIRE_WEBHOOK_API_KEY") ?? "true").toLowerCase() !== "false";
  const expected = Deno.env.get("MONGIKE_WEBHOOK_API_KEY") || Deno.env.get("MONGIKE_API_KEY") || "";
  const provided = req.headers.get("x-api-key") ?? "";
  if (requireApiKey && (!expected || !timingSafeEqual(expected, provided))) {
    console.warn(JSON.stringify({
      event: "mongike_webhook_rejected",
      reason: "invalid_x_api_key",
      provided: provided ? "[present]" : "[missing]",
    }));
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orderId = resolveOrderId(payload);
  const paymentStatus = normalizePaymentStatus(payload);
  const reference = resolveReference(payload);

  if (!orderId) {
    console.warn(JSON.stringify({
      event: "mongike_webhook_ignored",
      reason: "missing_order_id",
      payload,
    }));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updates: Record<string, unknown> = {
    status: paymentStatus || "COMPLETED",
    webhook_payload: payload,
  };
  if (reference) updates.gateway_ref = reference;

  const { data: updatedRows, error } = await supabase
    .from("donations")
    .update(updates)
    .eq("id", orderId)
    .select("id,status,gateway_ref,updated_at");

  if (error) {
    console.error("Update donation failed", error);
  } else {
    console.log(JSON.stringify({
      event: "donation_updated_from_webhook",
      order_id: orderId,
      payment_status: paymentStatus,
      gateway_ref: reference,
      matched_rows: updatedRows?.length ?? 0,
      updated_rows: updatedRows ?? [],
    }));
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
