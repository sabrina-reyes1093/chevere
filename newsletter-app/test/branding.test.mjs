import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(projectRoot, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
const readPublic = (file) => fs.readFileSync(path.join(publicRoot, file), "utf8");

test("the supplied Chévere heart wordmark is shared by every public header", () => {
  const pages = [
    ...fs.readdirSync(publicRoot).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, file)),
    ...fs.readdirSync(path.join(publicRoot, "posts")).filter((file) => file.endsWith(".html")).map((file) => path.join(publicRoot, "posts", file)),
  ];

  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    if (!html.includes('class="header-logo"')) continue;
    assert.match(html, /<img src="(?:\.\.\/)?assets\/logo\.png" alt="(?:Ch&eacute;vere|ch&eacute;vere|chévere|chevere|Chévere)"/);
  }

  assert.ok(fs.statSync(path.join(publicRoot, "assets", "logo.png")).size > 1_000_000);
});

test("public footer and admin surfaces use the same logo artwork", () => {
  const site = readPublic("site.js");
  const styles = readPublic("styles.css");
  const shell = read("components/admin-shell.tsx");
  const login = read("app/admin/login/page.tsx");
  const publicLogo = fs.readFileSync(path.join(publicRoot, "assets", "logo.png"));
  const adminLogo = fs.readFileSync(path.join(projectRoot, "public", "chevere-logo.png"));

  assert.match(site, /class="footer-logo"[\s\S]*?assets\/logo\.png/);
  assert.match(styles, /\.header-logo::after \{ content: none !important; \}/);
  assert.match(styles, /\.header-logo \{[\s\S]*?width: 58px !important;[\s\S]*?height: 58px !important;/);
  assert.match(styles, /\.footer-logo \{[\s\S]*?width: 86px;[\s\S]*?height: 86px;/);
  assert.match(styles, /\.hero-portrait \{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.doesNotMatch(styles, /\.hero-portrait \{ padding: 3px; \}/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.hero-portrait img\.hero-portrait__collage \{[\s\S]*?object-fit: contain;[\s\S]*?object-position: center;/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.hero-portrait \{[\s\S]*?width: min\(94%, 430px\);[\s\S]*?aspect-ratio: 1341 \/ 1173;[\s\S]*?overflow: visible;/);
  assert.match(styles, /\.hero-portrait img\.hero-portrait__collage \{[\s\S]*?object-fit: contain;[\s\S]*?transform: scale\(\.94\);/);
  assert.match(styles, /\.hero-portrait \{[\s\S]*?box-shadow: none;/);
  assert.match(styles, /\.hero-cloud--front \{ left: -5%; bottom: 9%; z-index: 2; transform: scale\(\.94\); \}/);
  assert.doesNotMatch(readPublic("index.html"), /class="hero-caption"/);
  assert.match(readPublic("index.html"), /chevere-homepage-editorial-collage-final\.png\?v=20260804-3/);
  assert.match(shell, /<Image src="\/chevere-logo\.png" alt="Chévere"/);
  assert.match(login, /<Image className="login-logo" src="\/chevere-logo\.png"/);
  assert.deepEqual(publicLogo, adminLogo);
});
