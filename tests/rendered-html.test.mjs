import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Allens Lane homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Allens Lane Art Center \| Inspiring Creativity and Culture<\/title>/i);
  assert.match(html, /Bringing our community together through transformative and joyful experiences in the arts/i);
  assert.match(html, /Allens Lane Art Center home/i);
  assert.match(html, /2026 Fall Session/i);
  assert.match(html, /Thank you to our sponsors!/i);
  assert.match(html, /Philadelphia Cultural Fund/i);
  assert.match(html, /allenslane\.us1\.list-manage\.com\/subscribe\?u=2738b4d92a840412099e68dba(?:&|&amp;)id=0c13d8b8c1/i);
});

test("keeps public pages free of ChatGPT sign-in and starter preview artifacts", async () => {
  const response = await render();
  const html = await response.text();
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(html, /signin-with-chatgpt|sign in with chatgpt|codex-preview/i);
  assert.doesNotMatch(layout, /signin-with-chatgpt|codex-preview|_sites-preview/i);
  assert.doesNotMatch(page, /signin-with-chatgpt|codex-preview|_sites-preview/i);
  assert.match(layout, /Allens Lane Art Center \| Inspiring Creativity and Culture/);
  assert.match(packageJson, /"name": "allens-lane-art-center"/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("server-renders the customer account route without gating public pages", async () => {
  const response = await render("/account");
  const authPanel = await readFile(new URL("../app/account/auth-panel.tsx", import.meta.url), "utf8");
  const householdManager = await readFile(new URL("../app/account/household-manager.tsx", import.meta.url), "utf8");
  const householdMigration = await readFile(new URL("../supabase/migrations/20260806182153_customer_household_workflows.sql", import.meta.url), "utf8");
  const registrationMigration = await readFile(new URL("../supabase/migrations/20260806194015_customer_registration_holds.sql", import.meta.url), "utf8");
  const stripeMigration = await readFile(new URL("../supabase/migrations/20260806213224_stripe_registration_checkout.sql", import.meta.url), "utf8");
  const checkoutFunction = await readFile(new URL("../supabase/functions/create-registration-checkout/index.ts", import.meta.url), "utf8");
  const webhookFunction = await readFile(new URL("../supabase/functions/stripe-registration-webhook/index.ts", import.meta.url), "utf8");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>My Account \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Customer portal/i);
  assert.match(html, /Manage your household and prepare for registration/i);
  assert.match(html, /Loading your account/i);
  assert.match(authPanel, /Create your staff password/i);
  assert.match(authPanel, /parameters\.has\("invite"\)/i);
  assert.match(authPanel, /<HouseholdManager userId=\{user\.id\} refreshKey=\{householdRefreshKey\}/i);
  assert.match(authPanel, /\.from\("payment_checkout_sessions"\)/i);
  assert.match(authPanel, /Payment confirmed\. The registration is now active/i);
  assert.match(householdManager, /rpc\("save_customer_household"/i);
  assert.match(householdManager, /rpc\("save_household_participant"/i);
  assert.match(householdManager, /Household Profile/i);
  assert.match(householdManager, /Household Participants/i);
  assert.match(householdManager, /Registration &amp; Waitlist Activity/i);
  assert.match(householdMigration, /revoke insert, update, delete on public\.people, public\.households/i);
  assert.match(householdMigration, /if not private\.can_manage_household\(p_household_id\)/i);
  assert.match(householdMigration, /p\.auth_user_id is null/i);
  assert.match(householdMigration, /false, false,\s*false, 'active'/i);
  assert.match(registrationMigration, /create table public\.registration_holds/i);
  assert.match(registrationMigration, /for update of c/i);
  assert.match(registrationMigration, /private\.can_manage_household\(hm\.household_id\)/i);
  assert.match(registrationMigration, /revoke all on function public\.prepare_class_registration/i);
  assert.match(stripeMigration, /create table public\.payment_checkout_sessions/i);
  assert.match(stripeMigration, /create table private\.stripe_webhook_events/i);
  assert.match(stripeMigration, /alter table public\.payment_checkout_sessions enable row level security/i);
  assert.match(stripeMigration, /create or replace function public\.finalize_registration_checkout/i);
  assert.match(stripeMigration, /'stripe_checkout', p_session_id/i);
  assert.match(stripeMigration, /grant execute on function public\.finalize_registration_checkout[\s\S]*to service_role/i);
  assert.match(checkoutFunction, /idempotencyKey: `registration-checkout-\$\{payload\.checkout_id\}`/i);
  assert.match(checkoutFunction, /Deno\.env\.get\("STRIPE_SECRET_KEY"\)/i);
  assert.match(checkoutFunction, /rpc\("get_integration_secret", \{ p_setting_key: "stripe_secret_key" \}\)/i);
  assert.match(checkoutFunction, /rpc\("get_integration_secret", \{ p_setting_key: "app_url" \}\)/i);
  assert.match(webhookFunction, /const rawBody = await request\.text\(\)/i);
  assert.match(webhookFunction, /constructEventAsync/i);
  assert.match(webhookFunction, /Deno\.env\.get\("STRIPE_WEBHOOK_SECRET"\)/i);
  assert.match(webhookFunction, /rpc\("get_integration_secret", \{ p_setting_key: "stripe_webhook_secret" \}\)/i);
  assert.match(webhookFunction, /rpc\("finalize_registration_checkout"/i);
  assert.doesNotMatch(`${checkoutFunction}\n${webhookFunction}`, /sk_(?:test|live)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}/i);
  assert.doesNotMatch(householdManager, /SUPABASE_SECRET_KEY|service_role|sb_secret_/i);
});

test("server-renders the protected staff portal shell", async () => {
  const response = await render("/staff");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Staff Portal \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Secure access for programs, registrations, people, publishing, finance, and reporting/i);
  assert.match(html, /Staff access requires two steps/i);
  assert.match(html, /Checking secure staff access/i);
});

test("server-renders the protected finance overview shell", async () => {
  const response = await render("/staff/finance");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Finance Overview \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Read-only visibility into orders, payments, paper-check refunds, and reconciliation status/i);
  assert.match(html, /Loading protected finance records/i);
});

test("server-renders the protected people directory shell", async () => {
  const response = await render("/staff/people");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>People Directory \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Find customer contact records and their active household relationships/i);
  assert.match(html, /Loading protected people records/i);
});

test("server-renders the protected programs and registration overview shell", async () => {
  const response = await render("/staff/programs");
  const staffPortal = await readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8");
  const editor = await readFile(new URL("../app/staff/programs/catalog-editor.tsx", import.meta.url), "utf8");
  const enrollmentDesk = await readFile(new URL("../app/staff/programs/enrollment-desk.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260806135059_catalog_write_workflows.sql", import.meta.url), "utf8");
  const enrollmentMigration = await readFile(new URL("../supabase/migrations/20260806211214_enrollment_operations.sql", import.meta.url), "utf8");
  const enrollmentHardening = await readFile(new URL("../supabase/migrations/20260806211443_harden_enrollment_operation_wrapper.sql", import.meta.url), "utf8");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Programs &amp; Registration \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Review the active catalog, schedules, enrollment, capacity, and waitlist activity/i);
  assert.match(html, /Loading protected program records/i);
  assert.match(staffPortal, /href: "\/staff\/programs"/i);
  assert.match(editor, /rpc\("save_program"/i);
  assert.match(editor, /rpc\("save_term"/i);
  assert.match(editor, /rpc\("save_facility"/i);
  assert.match(editor, /rpc\("save_class"/i);
  assert.match(editor, /Operational reason/i);
  assert.match(migration, /revoke insert, update, delete on public\.classes from authenticated/i);
  assert.match(migration, /Catalog Publisher permission is required/i);
  assert.match(migration, /audit_classes/i);
  assert.match(enrollmentDesk, /Enrollment Desk/i);
  assert.match(enrollmentDesk, /from\("enrollment_desk_entries"\)/i);
  assert.match(enrollmentDesk, /rpc\("manage_enrollment_record"/i);
  assert.match(enrollmentDesk, /Operational reason/i);
  assert.match(enrollmentMigration, /with \(security_invoker = true\)/i);
  assert.match(enrollmentMigration, /Canvas-managed classes are read-only/i);
  assert.match(enrollmentMigration, /Offers must follow the waitlist order/i);
  assert.match(enrollmentMigration, /revoke insert, update, delete on public\.registrations from authenticated/i);
  assert.match(enrollmentHardening, /set schema private/i);
  assert.match(enrollmentHardening, /p_offer_hours is null/i);
  assert.match(enrollmentHardening, /The enrollment record changed before the action completed/i);
});

test("server-renders the protected content and events overview shell", async () => {
  const response = await render("/staff/content");
  const staffPortal = await readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8");
  const editor = await readFile(new URL("../app/staff/content/content-event-editor.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260806131331_content_event_write_workflows.sql", import.meta.url), "utf8");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Content &amp; Events \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Review editorial content, publication readiness, event schedules, and retained ticketing links/i);
  assert.match(html, /Loading protected content and event records/i);
  assert.match(staffPortal, /href: "\/staff\/content"/i);
  assert.match(editor, /rpc\("save_content_item"/i);
  assert.match(editor, /rpc\("save_event"/i);
  assert.match(editor, /Operational reason/i);
  assert.match(migration, /revoke insert, update, delete on public\.content_items from authenticated/i);
  assert.match(migration, /Content Publisher permission is required/i);
  assert.match(migration, /audit_content_items/i);
});

test("server-renders the protected administration overview shell", async () => {
  const response = await render("/staff/admin");
  const administration = await readFile(new URL("../app/staff/admin/administration-overview.tsx", import.meta.url), "utf8");
  const integrations = await readFile(new URL("../app/staff/admin/integration-settings.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260807083303_admin_integration_secrets.sql", import.meta.url), "utf8");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Administration Overview \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Manage staff access, encrypted API and webhook configuration, and audit history with MFA and approval safeguards/i);
  assert.match(html, /Loading protected administration records/i);
  assert.match(administration, /functions\.invoke\("invite-staff"/i);
  assert.match(administration, /Send staff invitation/i);
  assert.match(administration, /permissions\.has\("integrations\.manage"\)/i);
  assert.match(administration, /<IntegrationSettings \/>/i);
  assert.match(integrations, /\.from\("integration_settings"\)/i);
  assert.match(integrations, /rpc\("save_integration_setting"/i);
  assert.match(integrations, /type=\{isSecret\(setting\) \? "password"/i);
  assert.match(integrations, /autoComplete="off"/i);
  assert.match(integrations, /Vault managed/i);
  assert.match(integrations, /Webhook callback URL/i);
  assert.doesNotMatch(integrations, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/i);
  assert.match(migration, /alter table public\.integration_settings force row level security/i);
  assert.match(migration, /private\.authorize\('integrations\.manage'\)/i);
  assert.match(migration, /vault\.create_secret/i);
  assert.match(migration, /vault\.update_secret/i);
  assert.match(migration, /join vault\.decrypted_secrets/i);
  assert.match(migration, /grant execute on function public\.save_integration_setting[\s\S]*to authenticated/i);
  assert.match(migration, /grant execute on function public\.get_integration_secret[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /sk_(?:test|live)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}/i);
});

test("keeps the public classes page available while progressively loading the published catalog", async () => {
  const response = await render("/classes");
  const [catalog, importMigration, importData] = await Promise.all([
    readFile(new URL("../app/[...slug]/public-class-catalog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260806205734_import_canvas_class_catalog.sql", import.meta.url), "utf8"),
    readFile(new URL("../data/imports/canvas-classes-2026-08-06.json", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Classes \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Studio art and creative learning for children, teens, and adults/i);
  assert.match(html, /Registration continues through the Allens Lane Canvas portal during the transition/i);
  assert.match(catalog, /\.from\("classes"\)/i);
  assert.match(catalog, /\.in\("status", publicStatuses\)/i);
  assert.match(catalog, /\.from\("programs"\).*\.eq\("status", "published"\)/i);
  assert.match(catalog, /if \(classes\.length === 0\) return null/i);
  assert.match(catalog, /rpc\("prepare_class_registration"/i);
  assert.match(catalog, /Register in Canvas/i);
  assert.match(catalog, /external_registration_url/i);
  assert.match(catalog, /source_schedule_text/i);
  assert.match(catalog, /functions\.invoke\("create-registration-checkout"/i);
  assert.match(catalog, /https:\/\/checkout\.stripe\.com/i);
  assert.match(catalog, /Enrollment is confirmed only after Stripe verifies/i);
  assert.equal(JSON.parse(importData).length, 56);
  assert.match(importMigration, /checkout_mode text not null default 'internal'/i);
  assert.match(importMigration, /classes_external_checkout_status_check/i);
  assert.match(importMigration, /'art_center_canvas'/i);
  assert.doesNotMatch(catalog, /SUPABASE_SECRET_KEY|service_role|sb_secret_/i);
});

test("completes public search, contact, team, and audience class routes", async () => {
  const [searchResponse, contactResponse, teamResponse, adultResponse, missingResponse] = await Promise.all([
    render("/search?q=theater"),
    render("/contact"),
    render("/about/our-team"),
    render("/classes/adults"),
    render("/this-page-does-not-exist"),
  ]);
  const [searchHtml, contactHtml, teamHtml, adultHtml] = await Promise.all([
    searchResponse.text(), contactResponse.text(), teamResponse.text(), adultResponse.text(),
  ]);
  const [interiorPage, contactForm, shell] = await Promise.all([
    readFile(new URL("../app/[...slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[...slug]/contact-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(searchResponse.status, 200);
  assert.match(searchHtml, /Search results for “theater”/i);
  assert.match(searchHtml, /Current Theater Season/i);
  assert.match(searchHtml, /Open page/i);
  assert.equal(contactResponse.status, 200);
  assert.match(contactHtml, /Prepare email/i);
  assert.match(contactForm, /mailto:info@allenslane\.org/i);
  assert.equal(teamResponse.status, 200);
  assert.match(teamHtml, /team-tara\.png/i);
  assert.match(teamHtml, /Nan Latona/i);
  assert.equal(adultResponse.status, 200);
  assert.match(adultHtml, /Adult Classes/i);
  assert.match(interiorPage, /initialQuery=\{path === "classes\/adults" \? "adult"/i);
  assert.match(shell, /href: "\/classes\/"/i);
  assert.match(shell, /href: "\/events\/"/i);
  assert.match(shell, /href: "\/support\/donate\/"/i);
  assert.doesNotMatch(interiorPage, /href="#"|Image placeholder|Portrait placeholder|ready for final content/i);
  assert.equal(missingResponse.status, 404);
});

test("publishes crawler metadata for the completed public route map", async () => {
  const [sitemapResponse, robotsResponse] = await Promise.all([render("/sitemap.xml"), render("/robots.txt")]);
  const [sitemapXml, robotsText] = await Promise.all([sitemapResponse.text(), robotsResponse.text()]);
  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemapXml, /<loc>https:\/\/allens-lane-art-center-clone\.ecomexperts\.chatgpt\.site\/classes<\/loc>/i);
  assert.match(sitemapXml, /profile\/tara-harrison-turner/i);
  assert.equal(robotsResponse.status, 200);
  assert.match(robotsText, /Disallow: \/staff\//i);
  assert.match(robotsText, /Sitemap: https:\/\/allens-lane-art-center-clone\.ecomexperts\.chatgpt\.site\/sitemap\.xml/i);
});
