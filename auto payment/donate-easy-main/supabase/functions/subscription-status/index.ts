import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_LABELS: Record<string, string> = {
  "2_hours": "2 Hours",
  "6_hours": "6 Hours",
  "1_day": "1 Day",
  "1_week": "1 Week",
  "week": "Week",
  "2_weeks": "2 Weeks",
  "2_week": "2 Weeks",
  "1_month": "1 Month",
  "month": "Month",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const userId = String(url.searchParams.get("user_id") ?? "").trim();
    if (!userId) return json({ error: "user_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.rpc("update_subscription_statuses");

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .select("user_id,status,plan,amount,phone,days_assigned,start_date,expiry_date,last_payment_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("subscription-status query failed", error);
      return json({ error: "Failed to fetch subscription" }, 500);
    }

    if (!subscription) {
      return json({
        ok: true,
        subscription: {
          user_id: userId,
          status: "unpaid",
          plan: null,
          plan_label: null,
          days_remaining: 0,
          start_date: null,
          expiry_date: null,
        }
      });
    }

    const expiryTime = subscription.expiry_date ? new Date(subscription.expiry_date).getTime() : 0;
    const now = Date.now();
    const daysRemaining = expiryTime > now
      ? Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000))
      : 0;

    return json({
      ok: true,
      subscription: {
        ...subscription,
        status: daysRemaining > 0 ? "paid" : "unpaid",
        plan_label: subscription.plan ? (PLAN_LABELS[subscription.plan] ?? subscription.plan) : null,
        days_remaining: daysRemaining,
      }
    });
  } catch (error) {
    console.error("subscription-status error", error);
    return json({ error: "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
