import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { siteContentSchema } from "../lib/site-content-schema.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(projectRoot, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
const readPublic = (file) => fs.readFileSync(path.join(publicRoot, file), "utf8");

test("seasonal site content stores the active season and an ordered unique post selection", () => {
  const content = JSON.parse(readPublic("site-content.json"));
  const schema = read("lib/site-content-schema.ts");

  assert.equal(content.seasonal_banner.season, "Summer");
  assert.equal(content.seasonal_banner.year, 2026);
  assert.deepEqual(content.seasonal_banner.post_slugs, [
    "chevere-summer-reading-edit",
    "best-chicago-patios-2026",
    "dua-lipa-vacation",
  ]);
  assert.match(schema, /z\.enum\(\["Spring", "Summer", "Fall", "Winter"\]\)/);
  assert.match(schema, /\.min\(1\)\.max\(12\)/);
  assert.match(schema, /new Set\(slugs\)\.size === slugs\.length/);
});

test("seasonal content schema applies legacy defaults and rejects invalid persisted state", () => {
  const current = JSON.parse(readPublic("site-content.json"));
  const legacy = structuredClone(current);
  delete legacy.seasonal_banner.season;
  delete legacy.seasonal_banner.year;
  delete legacy.seasonal_banner.post_slugs;

  const upgraded = siteContentSchema.parse(legacy);
  assert.equal(upgraded.seasonal_banner.season, "Summer");
  assert.equal(upgraded.seasonal_banner.year, 2026);
  assert.equal(upgraded.seasonal_banner.post_slugs.length, 3);

  const parseWith = (changes) => siteContentSchema.safeParse({
    ...current,
    seasonal_banner: { ...current.seasonal_banner, ...changes },
  });
  assert.equal(parseWith({ season: "Monsoon" }).success, false);
  assert.equal(parseWith({ year: 2101 }).success, false);
  assert.equal(parseWith({ post_slugs: [] }).success, false);
  assert.equal(parseWith({ post_slugs: Array.from({ length: 13 }, (_, index) => `post-${index + 1}`) }).success, false);
  assert.equal(parseWith({ post_slugs: ["same-post", "same-post"] }).success, false);
  assert.equal(parseWith({ post_slugs: ["Not A Slug"] }).success, false);
  assert.equal(parseWith({ publish_date: "2026-99-99" }).success, false);
  assert.equal(parseWith({ publish_date: "2026-09-15", expiration_date: "2026-09-14" }).success, false);
  assert.equal(parseWith({ post_slugs: ["one-post"] }).success, true);
  assert.equal(parseWith({ post_slugs: Array.from({ length: 12 }, (_, index) => `post-${index + 1}`) }).success, true);
});

test("Site Content lets the administrator change seasons and curate published stories", () => {
  const page = read("app/admin/site-content/page.tsx");
  const editor = read("components/site-content-editor.tsx");

  assert.match(page, /loadPublishedArticles/);
  assert.match(page, /articles=\{articles\}/);
  assert.match(editor, /Current season/);
  assert.match(editor, /The \$\{season\} Guide/);
  assert.match(editor, /Stories in this guide/);
  assert.match(editor, /Add another story/);
  assert.match(editor, /moved to position/);
  assert.match(editor, /Guide preview/);
  assert.match(editor, /Save & Publish Seasonal Guide/);
});

test("the protected save route accepts only published seasonal selections", () => {
  const route = read("app/api/admin/site-content/route.ts");

  assert.match(route, /requireAdminApi/);
  assert.match(route, /loadPublishedArticles/);
  assert.match(route, /loadPublishedArticles\(\{ fresh: true \}\)/);
  assert.match(route, /request\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(route, /publishedSlugs/);
  assert.match(route, /Every seasonal selection must be a published article/);
  assert.match(route, /saveSiteContent\(parsed\.data\)/);
});

test("the public seasonal guide renders the saved copy and selected posts in order", () => {
  const guide = readPublic("summer-guide.html");

  assert.match(guide, /fetch\('site-content\.json'/);
  assert.match(guide, /fetch\('blog\.html'/);
  assert.match(guide, /banner\.post_slugs/);
  assert.match(guide, /postSlugs\.map/);
  assert.match(guide, /postGrid\.replaceChildren\.apply/);
  assert.match(guide, /!banner\.enabled \|\| !isPublished \|\| !isCurrent/);
  assert.match(guide, /renderSelectedPosts\(content, ''\)/);
  assert.ok(guide.indexOf("if (!banner.enabled || !isPublished || !isCurrent)") < guide.indexOf("heading.textContent = banner.headline"));
  assert.match(guide, /heading\.textContent = banner\.headline/);
  assert.match(guide, /label\.textContent = banner\.label/);
  assert.match(guide, /setupFilters/);
});
