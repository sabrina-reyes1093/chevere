import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(projectRoot, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
const readPublic = (file) => fs.readFileSync(path.join(publicRoot, file), "utf8");

test("weekly roundup has one durable model with exact statuses and immutable send snapshots", () => {
  const migration = read("supabase/migrations/009_weekly_roundup.sql");
  assert.match(migration, /create type public\.roundup_status as enum \('draft', 'scheduled', 'published', 'archived'\)/i);
  assert.match(migration, /roundup_items jsonb/i);
  assert.match(migration, /roundup_snapshot jsonb/i);
  assert.match(migration, /homepage_publish_at timestamptz/i);
  assert.match(migration, /newsletter_issue_snapshots/i);
  assert.match(migration, /unique references public\.newsletter_issues/i);
  assert.match(migration, /jsonb_typeof\(recommendations\)/i);
  assert.match(read("supabase/migrations/006_issue_restructure.sql"), /jsonb_typeof\(recommendations\)/i);
  assert.match(read("lib/issue-mapper.ts"), /roundup\.length \? roundup : parseStoredItems\(row\.recommendations\)/);
  assert.match(read("lib/send-issue.ts"), /existingSnapshot\?\.issue_payload/);
});

test("publishing requires exactly three complete, ordered cards", () => {
  const schema = read("lib/issue-schema.ts");
  assert.match(schema, /items\.length !== 3/);
  assert.match(schema, /image_url/);
  assert.match(schema, /image_alt/);
  assert.match(schema, /destination URL/i);
  assert.match(schema, /display_order/);
});

test("public roundup is selected on the server with scheduled fallback behavior", () => {
  const route = read("app/api/roundup/route.ts");
  assert.match(route, /\.in\("roundup_status", \["published", "scheduled"\]\)/);
  assert.match(route, /\.lte\("homepage_publish_at", now\)/);
  assert.match(route, /\.order\("homepage_publish_at", \{ ascending: false \}\)/);
  assert.match(route, /for \(const row of data \|\| \[\]\)/);
  assert.match(route, /validateRoundupForPublication/);
  assert.match(route, /roundup_snapshot/);
});

test("admin supports publish, Sunday scheduling, archive, duplicate, reorder, and preview", () => {
  const editor = read("components/issue-editor.tsx");
  const action = read("app/api/admin/issues/[id]/roundup/route.ts");
  assert.match(editor, /Publish homepage now/);
  assert.match(editor, /Schedule homepage/);
  assert.match(editor, /Duplicate this issue/);
  assert.match(editor, /roundup-home-preview/);
  assert.match(editor, /earlier/);
  assert.match(editor, /later/);
  assert.match(editor, /Image alt text/);
  assert.match(editor, /Link type/);
  assert.match(action, /nextSundayAtChicagoTime/);
  assert.match(action, /roundup_snapshot: cards/);
});

test("homepage has the requested editorial order and no retired Currently Loving module", () => {
  const html = readPublic("index.html");
  const site = readPublic("site.js");
  const styles = readPublic("styles.css");
  const content = JSON.parse(readPublic("site-content.json"));
  const editor = read("components/site-content-editor.tsx");
  const contentSchema = read("lib/site-content-schema.ts");

  // Headline, CTA, and dates are all editable in the admin portal: assert the
  // shape the homepage depends on rather than the copy that happens to be live.
  assert.match(content.seasonal_banner.headline, /\S/);
  assert.match(content.seasonal_banner.cta_label, /\S/);
  assert.match(content.seasonal_banner.publish_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof content.seasonal_banner.expiration_date, "string");
  assert.equal("image_url" in content.seasonal_banner, false);
  assert.equal("image_alt" in content.seasonal_banner, false);
  assert.doesNotMatch(site, /seasonal-guide-media/);
  assert.doesNotMatch(styles, /seasonal-guide-media/);
  assert.match(site, /seasonal-cta/);
  assert.match(editor, /CTA label/);
  assert.match(editor, /Publish date/);
  assert.match(editor, /Expiration date/);
  assert.match(contentSchema, /cta_label/);
  assert.match(contentSchema, /publish_date/);
  assert.match(contentSchema, /expiration_date/);
  assert.doesNotMatch(site, /Currently Loving/i);
  assert.doesNotMatch(html, /Currently Loving/i);
  assert.match(site, /The Weekly Roundup/);
  assert.match(site, /This Week at Ch(?:é|&eacute;)vere/);
  assert.match(site, /cards\.length !== 3/);
  assert.match(site, /noopener noreferrer/);
  assert.match(site, /featuredReads\.insertAdjacentElement\('afterend', weekly\)/);
  assert.ok(site.indexOf("'<section class=\"newsletter\"") < site.indexOf("'<footer class=\"site-footer\""));
});

test("homepage and email consume the same ordered roundup card fields", () => {
  const site = readPublic("site.js");
  const template = read("lib/email-template.ts");
  const mapper = read("lib/issue-mapper.ts");
  for (const field of ["image_url", "image_alt", "category", "title", "text", "url", "cta_label", "display_order"]) {
    assert.match(mapper, new RegExp(field));
  }
  assert.match(site, /issue\.cards/);
  assert.match(template, /issue\.roundup_items/);
  assert.match(template, /emailUrl\(item\.url\)/);
});
