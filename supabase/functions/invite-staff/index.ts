import { createClient } from "npm:@supabase/supabase-js@2.112.1";

const allowedOrigins = new Set([
  "https://allens-lane-art-center-clone.ecomexperts.chatgpt.site",
  "http://localhost:3000",
]);

const staffRoles = new Set([
  "front_desk",
  "registrar",
  "instructor",
  "events_manager",
  "content_editor",
  "content_publisher",
  "development",
  "finance",
  "finance_approver",
  "reports_user",
  "support_admin",
  "system_admin",
]);

type InvitationRequest = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
  reason?: unknown;
};

function responseHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

function cleanString(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function readAal(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return String(JSON.parse(atob(normalized + padding)).aal ?? "");
  } catch {
    return "";
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(null, 403, { error: "This website origin is not allowed." });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Only POST requests are accepted." });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse(origin, 401, { error: "A signed-in staff session is required." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Required Supabase function environment variables are unavailable.");
    return jsonResponse(origin, 500, { error: "Staff invitations are temporarily unavailable." });
  }

  const token = authorization.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse(origin, 401, { error: "Your staff session is no longer valid. Sign in again." });
  }
  if (readAal(token) !== "aal2") {
    return jsonResponse(origin, 403, { error: "Authenticator verification is required before inviting staff." });
  }

  let body: InvitationRequest;
  try {
    body = await request.json() as InvitationRequest;
  } catch {
    return jsonResponse(origin, 400, { error: "The invitation request is not valid JSON." });
  }

  const email = cleanString(body.email, 320).toLowerCase();
  const firstName = cleanString(body.firstName, 80);
  const lastName = cleanString(body.lastName, 80);
  const role = cleanString(body.role, 40);
  const reason = cleanString(body.reason, 500);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(origin, 400, { error: "Enter a valid email address." });
  }
  if (!firstName || !lastName) {
    return jsonResponse(origin, 400, { error: "First and last name are required." });
  }
  if (!staffRoles.has(role)) {
    return jsonResponse(origin, 400, { error: "Select a valid staff role." });
  }
  if (reason.length < 10) {
    return jsonResponse(origin, 400, { error: "Provide an audit reason of at least 10 characters." });
  }

  const [{ data: account, error: accountError }, { data: roleRows, error: roleError }] = await Promise.all([
    userClient.from("staff_accounts").select("status").eq("auth_user_id", userData.user.id).maybeSingle(),
    userClient.from("user_roles").select("role").eq("auth_user_id", userData.user.id).is("revoked_at", null),
  ]);
  if (accountError || roleError || account?.status !== "active") {
    return jsonResponse(origin, 403, { error: "An active staff account is required." });
  }

  const activeRoles = roleRows?.map((row) => String(row.role)) ?? [];
  const { data: permissionRows, error: permissionError } = await userClient
    .from("role_permissions")
    .select("permission")
    .in("role", activeRoles);
  if (permissionError) {
    console.error("Permission lookup failed", permissionError.message);
    return jsonResponse(origin, 500, { error: "Staff permissions could not be verified." });
  }

  const permissions = new Set(permissionRows?.map((row) => String(row.permission)) ?? []);
  if (!permissions.has("staff.manage")) {
    return jsonResponse(origin, 403, { error: "Staff Management permission is required." });
  }
  if ((role === "finance" || role === "finance_approver") && !permissions.has("finance.approve")) {
    return jsonResponse(origin, 403, { error: "Finance Approver permission is required for Finance roles." });
  }
  if (role === "system_admin" && !activeRoles.includes("system_admin")) {
    return jsonResponse(origin, 403, { error: "Only a System Administrator may invite another System Administrator." });
  }

  const redirectOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : "https://allens-lane-art-center-clone.ecomexperts.chatgpt.site";
  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${redirectOrigin}/account?invite=1`,
    data: { first_name: firstName, last_name: lastName },
  });

  if (inviteError) {
    console.error("Staff invitation failed", inviteError.message);
    const alreadyRegistered = /already|registered|exists/i.test(inviteError.message);
    return jsonResponse(origin, alreadyRegistered ? 409 : 502, {
      error: alreadyRegistered
        ? "That email already has an account. Use Activate an existing account instead."
        : "The invitation email could not be sent. Try again or contact the system administrator.",
    });
  }

  const { error: activationError } = await userClient.rpc("activate_existing_staff", {
    target_email: email,
    requested_role: role,
    change_reason: reason,
  });
  if (activationError) {
    console.error("Invited account activation failed", activationError.message);
    return jsonResponse(origin, 500, {
      error: "The invitation was sent, but staff access could not be activated. Use Activate an existing account to finish setup.",
      invitationSent: true,
    });
  }

  return jsonResponse(origin, 201, {
    message: `Invitation sent to ${email}.`,
    email,
    role,
  });
});
