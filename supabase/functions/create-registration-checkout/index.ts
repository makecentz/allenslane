import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import Stripe from "npm:stripe@22.4.0";

const productionUrl = "https://allens-lane-art-center-clone.ecomexperts.chatgpt.site";
const allowedOrigins = new Set([
  productionUrl,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : productionUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function response(origin: string | null, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (request.method !== "POST") return response(origin, { error: "Method not allowed" }, 405);
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "Origin not allowed" }, 403);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response(origin, { error: "Sign in before starting checkout" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const siteUrl = Deno.env.get("APP_URL") ?? productionUrl;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(origin, { error: "Payment service is unavailable" }, 503);
  }

  let checkoutId: string | null = null;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const input = await request.json() as { holdId?: unknown };
    if (typeof input.holdId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.holdId)) {
      return response(origin, { error: "Choose a valid registration hold" }, 400);
    }

    const customer = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await customer.rpc("begin_registration_checkout", {
      p_hold_id: input.holdId,
    });
    if (error) throw new Error(error.message);

    const payload = data as {
      action: "create_checkout" | "checkout_ready" | "completed";
      checkout_id: string;
      checkout_url?: string | null;
      hold_id?: string;
      class_id?: string;
      class_code?: string;
      class_title?: string;
      participant_name?: string;
      customer_email?: string | null;
      amount_cents?: number;
      currency?: string;
      expires_at?: string;
    };
    checkoutId = payload.checkout_id;

    if (payload.action === "completed") {
      return response(origin, { status: "completed", url: `${siteUrl}/account?checkout=success` });
    }
    if (payload.action === "checkout_ready" && payload.checkout_url) {
      return response(origin, { status: "ready", url: payload.checkout_url });
    }
    if (!stripeSecretKey) {
      await admin.rpc("fail_registration_checkout", {
        p_checkout_id: checkoutId,
        p_reason: "Stripe secret is not configured",
      });
      return response(origin, { error: "Stripe Checkout is awaiting final account configuration" }, 503);
    }
    if (!payload.hold_id || !payload.class_id || !payload.class_title || !payload.amount_cents || !payload.currency || !payload.expires_at) {
      throw new Error("Checkout preparation returned incomplete data");
    }

    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const metadata = {
      checkout_id: payload.checkout_id,
      registration_hold_id: payload.hold_id,
      class_id: payload.class_id,
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: payload.checkout_id,
      customer_email: payload.customer_email ?? undefined,
      success_url: `${siteUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/classes?checkout=canceled`,
      expires_at: Math.floor(new Date(payload.expires_at).getTime() / 1000),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: payload.currency,
          unit_amount: payload.amount_cents,
          product_data: {
            name: payload.class_title,
            description: [payload.class_code, payload.participant_name].filter(Boolean).join(" · "),
          },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
    }, {
      idempotencyKey: `registration-checkout-${payload.checkout_id}`,
    });

    if (!session.url || !session.expires_at) throw new Error("Stripe Checkout did not return a redirect URL");

    const { error: attachError } = await admin.rpc("attach_registration_checkout", {
      p_checkout_id: payload.checkout_id,
      p_stripe_session_id: session.id,
      p_checkout_url: session.url,
      p_expires_at: new Date(session.expires_at * 1000).toISOString(),
      p_livemode: session.livemode,
    });
    if (attachError) throw new Error(attachError.message);

    return response(origin, { status: "ready", url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be started";
    console.error("Registration checkout error:", message);
    if (checkoutId) {
      await admin.rpc("fail_registration_checkout", {
        p_checkout_id: checkoutId,
        p_reason: message,
      });
    }
    return response(origin, { error: message }, 400);
  }
});
