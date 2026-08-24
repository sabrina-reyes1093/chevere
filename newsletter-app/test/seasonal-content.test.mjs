import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { siteContentSchema } from "../lib/site-content-schema.ts";
import { resolveSiteContentSource } from "../lib/site-content-admin-loader.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(projectRoot, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
const readPublic = (file) => fs.readFileSync(path.join(publicRoot, file), "utf8");

test("seasonal site content stores the active season and an ordered unique post selection", () => {
  const content = JSON.parse(readPublic("site-content.json"));
  const fallback = JSON.parse(read("site-content-fallback.json"));
  const schema = read("lib/site-content-schema.ts");

  // The admin portal owns these values, so assert the invariants it has to keep.
  // Pinning the current season or story list here would fail the build every time
  // someone curates the guide, which is exactly what the feature is for.
  const banner = siteContentSchema.parse(content).seasonal_banner;
  assert.deepEqual(fallback, content, "the hosted fallback must track the published site content");
  assert.ok(["Spring", "Summer", "Fall", "Winter"].includes(banner.season));
  assert.ok(Number.isInteger(banner.year) && banner.year >= 2020 && banner.year <= 2100);
  assert.ok(banner.post_slugs.length >= 1 && banner.post_slugs.length <= 12);
  assert.equal(new Set(banner.post_slugs).size, banner.post_slugs.length);
  for (const slug of banner.post_slugs) {
    assert.ok(
      fs.existsSync(path.join(publicRoot, "posts", `${slug}.html`)),
      `seasonal selection "${slug}" does not resolve to a published post`,
    );
  }
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
  assert.match(editor, /Boolean\(contentLoadWarning\)/);
});

test("hosted Site Content falls back safely when its repository source is unavailable", async () => {
  const fallback = JSON.stringify({ seasonal_banner: { headline: "Bundled guide" } });
  const validateSource = (source) => { JSON.parse(source); };
  const hosted = await resolveSiteContentSource({
    githubConfigured: true,
    bundledSource: fallback,
    loadRemote: async () => { throw new Error("repository unavailable"); },
    loadLocal: async () => "local",
    validateSource,
  });

  assert.equal(hosted.source, fallback);
  assert.equal(hosted.usedFallback, true);

  const malformedRemote = await resolveSiteContentSource({
    githubConfigured: true,
    bundledSource: fallback,
    loadRemote: async () => "not json",
    loadLocal: async () => "local",
    validateSource,
  });
  assert.equal(malformedRemote.source, fallback);
  assert.equal(malformedRemote.usedFallback, true);

  const remote = await resolveSiteContentSource({
    githubConfigured: true,
    bundledSource: fallback,
    loadRemote: async () => "{\"remote\":true}",
    loadLocal: async () => "local",
    validateSource,
  });
  assert.equal(remote.source, "{\"remote\":true}");
  assert.equal(remote.usedFallback, false);

  const missingRemote = await resolveSiteContentSource({
    githubConfigured: true,
    bundledSource: fallback,
    loadRemote: async () => null,
    loadLocal: async () => "local",
    validateSource,
  });
  assert.equal(missingRemote.source, fallback);

  const local = await resolveSiteContentSource({
    githubConfigured: false,
    bundledSource: fallback,
    loadRemote: async () => null,
    loadLocal: async () => "{\"local\":true}",
    validateSource,
  });
  assert.equal(local.source, "{\"local\":true}");
  assert.equal(local.usedFallback, false);

  const unavailableLocal = await resolveSiteContentSource({
    githubConfigured: false,
    bundledSource: fallback,
    loadRemote: async () => null,
    loadLocal: async () => { throw new Error("file unavailable"); },
    validateSource,
  });
  assert.equal(unavailableLocal.source, fallback);
  assert.equal(unavailableLocal.usedFallback, true);

  const config = read("next.config.ts");
  assert.match(config, /SITE_CONTENT_FALLBACK_JSON/);
  assert.match(config, /site-content-fallback\.json/);
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
