import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CATEGORY_GROUPS, SERIES_OPTIONS, slugify, displayDate, categoryLabel, categoryLabels, categorySection, categorySections, normalizeCategory, normalizePostCategories, normalizePostCategory, postSchema, seriesEditionLabel, seriesLabel, validateForPublish } from "../lib/post-schema.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

test("slugs and dates match the conventions already used on the site", () => {
  assert.equal(slugify("My Current Obsessions"), "my-current-obsessions");
  assert.equal(slugify("The Chévere Guide to Chicago Patio Season"), "the-chevere-guide-to-chicago-patio-season");
  assert.equal(slugify("  Trailing & Symbols!  "), "trailing-symbols");
  assert.equal(displayDate("2026-07-18"), "Jul 18, 2026");
  assert.equal(displayDate("2026-01-02"), "Jan 2, 2026");
  assert.equal(categoryLabel("film-tv"), "Film & TV");
  assert.equal(categoryLabel("tv-film"), "Film & TV");
  assert.equal(categorySection("reading-lists"), "guides");
  assert.equal(categorySection("introduction"), "");
  assert.equal(normalizeCategory("food-drink"), "food");
  assert.equal(normalizeCategory("wellness"), "life-wellness");
  assert.equal(normalizePostCategory("food-drink", "best-chicago-patios-2026"), "restaurant-roundups");
  assert.equal(normalizePostCategory("pop-culture", "about-chevere"), "introduction");
  assert.equal(normalizePostCategory("pop-culture", "maybe-women-should-be-more-difficult"), "life-wellness");
  assert.equal(normalizePostCategory("everyday-favorites", "my-current-obsessions"), "pop-culture");
  assert.deepEqual(normalizePostCategories("books,reading-lists", "chevere-summer-reading-edit"), ["books", "reading-lists"]);
  assert.equal(categoryLabels("books,reading-lists"), "Books · Reading Lists");
  assert.deepEqual(categorySections("books,reading-lists"), ["culture", "guides"]);
  assert.deepEqual(CATEGORY_GROUPS.map((group) => group.label), ["Culture", "Style", "Life", "Guides"]);
  const activeCategories = CATEGORY_GROUPS.flatMap((group) => group.categories.map((category) => category.slug));
  assert.equal(activeCategories.includes("everyday-favorites"), false);
  assert.equal(activeCategories.includes("hosting"), false);
  assert.equal(activeCategories.includes("evergreen-guides"), false);
});

test("Art is offered in the admin editor and reachable from the public Culture menu", () => {
  const culture = CATEGORY_GROUPS.find((group) => group.slug === "culture");
  assert.ok(culture.categories.some((item) => item.slug === "art" && item.label === "Art"));

  // The editor renders its checkboxes from CATEGORY_GROUPS, so being in the
  // taxonomy is what puts Art on the posting form.
  assert.match(read("components/post-editor.tsx"), /CATEGORY_GROUPS\.map/);
  assert.equal(categoryLabel("art"), "Art");
  assert.equal(categorySection("art"), "culture");
  assert.equal(normalizeCategory("art"), "art");
  assert.equal(postSchema.safeParse({
    slug: "an-art-post", title: "An Art Post", category: "art", dek: "A description.",
    body: "Some words.", cover_image_url: "https://example.com/c.png", hero_image_url: "",
    signoff: "", published_on: "2026-08-05",
  }).success, true);

  // A category readers cannot browse to would only be half-added.
  const publicRoot = path.resolve(projectRoot, "..");
  const pages = [
    ...fs.readdirSync(publicRoot).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, file)),
    ...fs.readdirSync(path.join(publicRoot, "posts")).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, "posts", file)),
  ];
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    if (!html.includes("cat=books")) continue;
    assert.match(html, /blog\.html\?cat=art">Art<\/a>/, `${path.basename(page)} is missing the Art menu entry`);
  }

  // blog.html carries its own copy of the taxonomy and falls back to "show
  // everything" for a category it does not recognise, so Art has to be
  // registered in both maps or ?cat=art quietly lists every post.
  const blog = fs.readFileSync(path.join(publicRoot, "blog.html"), "utf8");
  assert.match(blog, /'art': 'Art'/);
  assert.match(blog, /'art': 'culture'/);
});

test("recurring Series stay separate from categories and main navigation", () => {
  assert.deepEqual(SERIES_OPTIONS.map((item) => item.label), ["None", "Weekly Roundup", "The Month Ahead", "Seasonal Guides"]);
  assert.equal(seriesLabel("the-month-ahead"), "The Month Ahead");
  assert.equal(seriesEditionLabel({
    series: "weekly-roundup", series_month: "", series_year: "", series_season: "",
    series_issue_number: "8", series_edition_date: "2026-08-23",
  }), "Weekly Roundup · No. 08 · Aug 23, 2026");

  const publicRoot = path.resolve(projectRoot, "..");
  const pages = [
    ...fs.readdirSync(publicRoot).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, file)),
    ...fs.readdirSync(path.join(publicRoot, "posts")).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, "posts", file)),
  ];
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    if (!html.includes('class="site-nav"')) continue;
    assert.doesNotMatch(html, /cat=(?:monthly|weekly|seasonal|newsletter)(?:["'&\s]|$)/, `${path.basename(page)} exposes a Series as a main category`);
  }

  const blog = fs.readFileSync(path.join(publicRoot, "blog.html"), "utf8");
  assert.doesNotMatch(blog, /data-cat="monthly"/);
  assert.match(blog, /id="guides-series-hub"/);
  assert.match(blog, /data-series-list="the-month-ahead"/);
  assert.match(blog, /data-series-list="seasonal-guides"/);
  assert.match(blog, /data-series-list="weekly-roundup"/);
  assert.match(blog, /data-show-latest/);
  assert.match(blog, /data-show-series/);
  assert.match(read("components/post-editor.tsx"), /CATEGORY_GROUPS\.map/);
  assert.match(read("components/posts-table.tsx"), /CATEGORIES\.map/);
  assert.match(read("components/post-editor.tsx"), />Series/);
  assert.match(read("components/post-editor.tsx"), /post\.series === "the-month-ahead"/);
  assert.match(read("components/post-editor.tsx"), /post\.series === "seasonal-guides"/);
  assert.match(read("components/post-editor.tsx"), /post\.series === "weekly-roundup"/);
  assert.doesNotMatch(read("lib/post-template.ts"), /cat=monthly/);
});

test("series metadata validates independently and persists through publishing", () => {
  const base = {
    slug: "an-edition", title: "An Edition", category: "seasonal-recommendations", dek: "A description.",
    body: "Some words.", cover_image_url: "https://example.com/c.png", hero_image_url: "",
    signoff: "", published_on: "2026-08-23", author: "Sabrina",
  };
  assert.equal(postSchema.safeParse({ ...base, series: "the-month-ahead", series_month: "09", series_year: "2026" }).success, true);
  assert.equal(postSchema.safeParse({ ...base, series: "the-month-ahead", series_year: "2026" }).success, false);
  assert.equal(postSchema.safeParse({ ...base, series: "seasonal-guides", series_season: "Fall", series_year: "2026" }).success, true);
  assert.equal(postSchema.safeParse({ ...base, series: "weekly-roundup", series_issue_number: "08", series_edition_date: "2026-08-23" }).success, true);

  const migration = read("supabase/migrations/012_post_series.sql");
  for (const column of ["series_month", "series_year", "series_season", "series_issue_number", "series_edition_date", "featured_on_homepage", "show_in_latest", "show_in_series_section", "author"]) {
    assert.match(migration, new RegExp(column));
  }
  const publish = read("lib/publish-post.ts");
  assert.match(publish, /data-series=/);
  assert.match(publish, /data-show-latest/);
  assert.match(publish, /data-show-series/);
  assert.match(read("lib/post-template.ts"), /seriesEditionLabel/);
  assert.match(read("lib/post-template.ts"), /post\.author/);
});

test("the homepage can feature the latest Month Ahead edition", () => {
  const route = read("app/api/series/the-month-ahead/route.ts");
  assert.match(route, /\.eq\("series", "the-month-ahead"\)/);
  assert.match(route, /\.eq\("status", "published"\)/);
  assert.match(route, /featured_on_homepage/);
  assert.match(route, /series_year/);
  assert.match(route, /series_month/);
  const site = fs.readFileSync(path.resolve(projectRoot, "..", "site.js"), "utf8");
  assert.match(site, /renderHomepageMonthAhead/);
  assert.match(site, /\/api\/series\/the-month-ahead/);
  assert.match(site, /month-ahead-feature/);
  assert.match(site, /Explore.*month/i);
});

test("a post cannot be published until it would render correctly", () => {
  const complete = {
    slug: "a-post", title: "A Post", category: "culture", dek: "A description.",
    body: "Some words.", cover_image_url: "https://example.com/c.png", hero_image_url: "",
    signoff: "", published_on: "2026-07-19",
  };
  assert.equal(validateForPublish(complete), null);
  assert.equal(postSchema.safeParse({ ...complete, category: "books,reading-lists" }).success, true);
  assert.match(validateForPublish({ ...complete, cover_image_url: "" }), /cover image/i);
  assert.match(validateForPublish({ ...complete, dek: "" }), /description/i);
  assert.match(validateForPublish({ ...complete, body: "" }), /body/i);
  assert.match(validateForPublish({ ...complete, title: "" }), /title/i);
});

test("generated pages carry the same shell as the hand-written posts", () => {
  const template = read("lib/post-template.ts");
  assert.match(template, /\.\.\/styles\.css\?v=/);
  assert.match(template, /\.\.\/site\.js\?v=/);
  assert.match(template, /class="site-header"/);
  assert.match(template, /class="site-nav"/);
  assert.match(template, />CULTURE</);
  assert.match(template, />STYLE</);
  assert.match(template, />LIFE</);
  assert.match(template, />GUIDES</);
  assert.match(template, /JOIN THE LIST/);
  assert.match(template, /mobile-menu-toggle/);
  assert.match(template, /class="page-main"/);
  assert.match(template, /class="post-body"/);
  assert.match(template, /Back to Blog/);
});

test("authored markdown is escaped before any formatting is applied", () => {
  const template = read("lib/post-template.ts");
  // escape() must run first inside inline(), so raw HTML in a post cannot inject markup.
  assert.match(template, /return escape\(value\)/);
});

test("editorial quote blocks render with an optional attribution", () => {
  const source = read("lib/post-template.ts");
  assert.match(source, /editorial-quote/);
  assert.match(source, /<blockquote>/);
  assert.match(source, /<figcaption>/);
});

test("publishing edits blog.html in place rather than reserialising it", () => {
  const publish = read("lib/publish-post.ts");
  assert.match(publish, /post-grid/);
  assert.match(publish, /post-card/);
  assert.match(publish, /categorySections/);
  assert.match(publish, /includes\("introduction"\)/);
  assert.doesNotMatch(publish, /cheerio|\$\.html\(\)/);
  assert.match(publish, /unpublishPost/);
});

test("every blog admin route requires the administrator", () => {
  for (const route of [
    "app/api/admin/posts/route.ts",
    "app/api/admin/posts/[id]/route.ts",
    "app/api/admin/posts/[id]/publish/route.ts",
    "app/api/admin/posts/preview/route.ts",
  ]) {
    assert.match(read(route), /requireAdminApi/, `${route} is unguarded`);
    assert.match(read(route), /Unauthorized/, `${route} does not reject`);
  }
});

test("the portal links the blog editor alongside the newsletter", () => {
  assert.match(read("components/admin-shell.tsx"), /\/admin\/posts/);
  assert.match(read("components/post-editor.tsx"), /ImageField/);
});

test("publishing commits to GitHub when the host cannot write files", () => {
  const route = read("app/api/admin/posts/[id]/publish/route.ts");
  assert.match(route, /githubConfigured/);
  assert.match(route, /publishPostToGitHub/);
  assert.match(route, /unpublishPostFromGitHub/);
  // The filesystem path must remain for running locally.
  assert.match(route, /publishPost\(/);
});

test("a read-only filesystem explains itself instead of leaking EROFS", () => {
  const route = read("app/api/admin/posts/[id]/publish/route.ts");
  assert.match(route, /EROFS\|read-only file system/);
  assert.match(route, /GITHUB_TOKEN and GITHUB_REPO/);
});

test("both files land in a single commit so the blog never links to a missing page", () => {
  const github = read("lib/publish-github.ts");
  // One tree, one commit, one ref update - not two content-API writes.
  assert.match(github, /git\/trees/);
  assert.match(github, /git\/commits/);
  assert.match(github, /git\/refs\/heads/);
  assert.match(github, /base_tree/);
  assert.match(github, /parents: \[headSha\]/);
  assert.match(github, /posts\/\$\{post\.slug\}\.html/);
  assert.match(github, /"blog\.html"/);
});

test("GitHub credentials are optional and never assumed present", () => {
  const configSource = read("lib/config.ts");
  // required() would throw at import time on a local setup with no token.
  assert.match(configSource, /githubToken\(\) \{ return process\.env\.GITHUB_TOKEN \|\| ""/);
  assert.match(configSource, /githubConfigured/);
  assert.match(read(".env.example"), /GITHUB_TOKEN=/);
});
