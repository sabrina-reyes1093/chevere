import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(projectRoot, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
const readPublic = (file) => fs.readFileSync(path.join(publicRoot, file), "utf8");

test("Featured Reads has a durable three-slot model with the requested defaults", () => {
  const migration = read("supabase/migrations/010_homepage_featured_reads.sql");
  assert.match(migration, /create table if not exists public\.homepage_featured_reads/i);
  assert.match(migration, /display_order between 1 and 3/i);
  assert.match(migration, /unique \(post_id\)/i);
  assert.match(migration, /maybe-women-should-be-more-difficult/);
  assert.match(migration, /chevere-summer-reading-edit/);
  assert.match(migration, /spain-wins-the-2026-world-cup/);
});

test("Featured Reads reads the manual admin selection, with an auto-fill-by-newest button", () => {
  const model = read("lib/featured-reads.ts");
  const editor = read("components/featured-reads-editor.tsx");
  assert.match(model, /fetch\(`\$\{config\.siteUrl\}\/blog\.html`/);
  assert.match(model, /\.from\("homepage_featured_reads"\)/);
  assert.match(model, /\.select\("display_order,post_slug"\)/);
  assert.match(editor, /Order by newest published/);
  assert.match(editor, /new Date\(b\.published_on\)\.getTime\(\) - new Date\(a\.published_on\)\.getTime\(\)/);
});

test("admin selection requires three unique published articles and supports reorder plus preview", () => {
  const route = read("app/api/admin/featured-reads/route.ts");
  const editor = read("components/featured-reads-editor.tsx");
  assert.match(route, /\.length\(3\)/);
  assert.match(route, /new Set\(value\.post_ids\)\.size !== 3/);
  assert.match(route, /loadPublishedArticles/);
  assert.match(route, /\.upsert\(rows, \{ onConflict: "display_order" \}\)/);
  assert.match(editor, /Move Featured Story/);
  assert.match(editor, /Homepage preview/);
  assert.match(editor, /Publish Featured Reads/);
  assert.match(editor, /disabled=\{saving \|\| !isComplete\}/);
});

test("homepage consumes only the independent Featured Reads endpoint and keeps exactly three fallbacks", () => {
  const site = readPublic("site.js");
  const html = readPublic("index.html");
  const featuredSection = html.match(/<section class="featured-reads[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(site, /\/api\/featured-reads/);
  assert.match(site, /items\.length === 3/);
  assert.doesNotMatch(site.match(/\/\* homepage featured reads[\s\S]*?\}\)\(\);/)?.[0] || "", /fetch\('blog\.html'\)/);
  assert.equal((featuredSection.match(/class="splide__slide"/g) || []).length, 3);
  assert.ok(featuredSection.indexOf("Maybe Women Should Be More Difficult") < featuredSection.indexOf("The Ch&eacute;vere Summer Reading Guide"));
  assert.ok(featuredSection.indexOf("The Ch&eacute;vere Summer Reading Guide") < featuredSection.indexOf("Spain Wins the 2026 World Cup"));
});

test("mobile homepage controls initialize immediately and remain inside the heading", () => {
  const site = readPublic("site.js");
  const styles = readPublic("styles.css");
  const mountIndex = site.indexOf("var mountedCarousel = mountCarousel();");
  const fetchIndex = site.indexOf("fetch(newsletterApi + '/api/featured-reads'");

  assert.ok(mountIndex >= 0 && mountIndex < fetchIndex);
  assert.match(site, /window\.innerWidth <= 620 \|\| typeof window\.Splide === 'undefined'/);
  assert.match(site, /return \{ refresh: refresh \};/);
  assert.match(site, /carousel\.classList\.add\('is-native-carousel'\)/);
  assert.match(styles, /\.featured-reads\.is-native-carousel \{ visibility: visible; \}/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.featured-heading \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.weekly-roundup-heading > a \{[\s\S]*?visibility: visible !important;[\s\S]*?pointer-events: auto !important;/);
});

test("mobile article search, social buttons, and theme switch share one aligned control row", () => {
  const styles = readPublic("styles.css");
  const siteScript = readPublic("site.js");

  assert.match(styles, /\/\* Shared header controls: consistent across hand-written and generated pages\. \*\/[\s\S]*?body:has\(\.post-body\) \.site-header \{ height: 112px; \}/);
  assert.match(styles, /body:has\(\.post-body\) \.header-actions \.theme-toggle \{[\s\S]*?left: calc\(50% - 90px\) !important;/);
  assert.match(styles, /body:has\(\.post-body\) \.header-actions #search-toggle \{[\s\S]*?left: calc\(50% - 34px\) !important;/);
  assert.match(styles, /body:has\(\.post-body\) \.header-actions a\[href\*="instagram\.com"\] \{[\s\S]*?left: calc\(50% \+ 10px\) !important;/);
  assert.match(styles, /body:has\(\.post-body\) \.header-actions a\[href\*="tiktok\.com"\] \{[\s\S]*?left: calc\(50% \+ 54px\) !important;/);
  assert.match(styles, /\.header-social \.tiktok-icon \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/);
  assert.match(styles, /\.theme-toggle__track \{[\s\S]*?border-radius: 999px;/);
  assert.match(siteScript, /instagram\.classList\.add\('header-social', 'instagram-link'\)/);
  assert.match(siteScript, /button\.setAttribute\('aria-pressed', String\(dark\)\)/);
});

test("Featured Reads and the newsletter roundup remain separate systems", () => {
  const featured = read("app/api/featured-reads/route.ts");
  const roundup = read("app/api/roundup/route.ts");
  assert.match(featured, /loadFeaturedReads/);
  assert.doesNotMatch(featured, /newsletter_issues/);
  assert.match(roundup, /newsletter_issues/);
  assert.doesNotMatch(roundup, /homepage_featured_reads/);
});

test("homepage editorial headings and podcast title use the requested language", () => {
  const site = readPublic("site.js");
  const styles = readPublic("styles.css");
  const mapper = read("lib/issue-mapper.ts");
  const backup = read("issues-backup.json");
  assert.match(site, /This Week at Ch&eacute;vere/);
  assert.match(site, /The edit, delivered/);
  assert.match(styles, /\.weekly-roundup-heading h2[\s\S]*?font-family: var\(--serif\);[\s\S]*?font-weight: 700;/);
  assert.match(mapper, /THERAPUSS by Jake Shane/);
  assert.match(backup, /THERAPUSS by Jake Shane/);
});
