import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the subscribe API activates an address without sending confirmation", () => {
  const route = fs.readFileSync(path.join(projectRoot, "app/api/subscribe/route.ts"), "utf8");

  assert.match(route, /status: "active"/);
  assert.match(route, /confirmed_at: now/);
  assert.doesNotMatch(route, /new Resend|randomToken|confirmation email|Check your inbox to confirm/);
});

test("the public form reports immediate subscription", () => {
  const site = fs.readFileSync(path.resolve(projectRoot, "../site.js"), "utf8");

  assert.match(site, /You&(?:rsquo|#39);re subscribed to Ch(?:é|&eacute;)vere Weekly\./);
  assert.match(site, /cache: 'no-store'/);
  assert.match(site, /response\.json\(\)/);
  assert.doesNotMatch(site, /Something went wrong/);
  assert.doesNotMatch(site, /Confirm your email to join/);
});

test("every public page loads the current signup script version", () => {
  const publicRoot = path.resolve(projectRoot, "..");
  const htmlFiles = [
    ...fs.readdirSync(publicRoot).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, file)),
    ...fs.readdirSync(path.join(publicRoot, "posts")).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, "posts", file)),
  ];

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    if (html.includes("site.js")) {
      assert.match(html, /site\.js\?v=20260803-6/);
      assert.match(html, /id="mobile-menu-toggle"/);
      assert.match(html, /JOIN THE LIST/);
      assert.match(html, />HOME<.*>CULTURE<.*>STYLE<.*>LIFE<.*>GUIDES<.*>ABOUT</s);
    }
  }
});

test("the migration activates existing pending subscribers", () => {
  const migration = fs.readFileSync(path.join(projectRoot, "supabase/migrations/002_immediate_subscription.sql"), "utf8");

  assert.match(migration, /where status = 'pending'/i);
  assert.match(migration, /set status = 'active'/i);
});
