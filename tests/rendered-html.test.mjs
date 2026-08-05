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
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>My Account \| Allens Lane Art Center<\/title>/i);
  assert.match(html, /Customer portal/i);
  assert.match(html, /Manage your household and prepare for registration/i);
  assert.match(html, /Loading your account/i);
});
