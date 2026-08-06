import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import Stripe from "npm:stripe@22.4.0";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const signature = request.headers.get("stripe-signature");

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Webhook is not configured" }, 503);
  }
  if (!signature) return json({ error: "Missing Stripe signature" }, 400);

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error("Stripe webhook signature rejected:", error instanceof Error ? error.message : "invalid signature");
    return json({ error: "Invalid Stripe signature" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") {
        return json({ received: true, status: "payment_pending" });
      }
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
      if (!paymentIntentId || !session.amount_total || !session.currency) {
        throw new Error("Completed Checkout Session is missing payment details");
      }

      const { data, error } = await supabase.rpc("finalize_registration_checkout", {
        p_event_id: event.id,
        p_session_id: session.id,
        p_payment_intent_id: paymentIntentId,
        p_amount_total: session.amount_total,
        p_currency: session.currency,
        p_paid_at: new Date(event.created * 1000).toISOString(),
        p_livemode: event.livemode,
      });
      if (error) throw new Error(error.message);
      return json({ received: true, result: data });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { data, error } = await supabase.rpc("expire_registration_checkout", {
        p_event_id: event.id,
        p_session_id: session.id,
        p_livemode: event.livemode,
      });
      if (error) throw new Error(error.message);
      return json({ received: true, result: data });
    }

    return json({ received: true, status: "ignored" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("Stripe webhook processing error:", message);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
