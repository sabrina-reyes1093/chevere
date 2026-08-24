import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

test("pasted images upload through an admin-only, type- and size-checked endpoint", () => {
  const route = read("app/api/admin/upload/route.ts");
  const media = read("lib/media-assets.ts");
  assert.match(route, /requireAdminApi/);
  assert.match(route, /Unauthorized/);
  assert.match(media, /"image\/png"/);
  assert.match(media, /"image\/webp"/);
  assert.match(route, /file\.size > MAX_BYTES/);
  assert.match(route, /uploadMediaAsset/);
});

test("the image bucket stays publicly readable so inboxes can load the images", () => {
  const migration = read("supabase/migrations/004_image_uploads.sql");
  assert.match(migration, /'newsletter-images',\s*\n\s*true/);
  assert.match(migration, /for select/);
});

test("featured and roundup images accept pasted images as well as URLs", () => {
  const editor = read("components/issue-editor.tsx");
  assert.equal((editor.match(/<ImageField/g) || []).length, 2);
  assert.match(editor, /featured_image_url/);
  assert.match(editor, /"image_url", url/);
  assert.match(editor, /Image alt text/);
});

test("a pasted file is uploaded so the field holds a URL, never inline base64", () => {
  const field = read("components/image-field.tsx");
  assert.match(field, /onPaste/);
  assert.match(field, /clipboardData\.files/);
  assert.match(field, /onDrop/);
  assert.match(field, /\/api\/admin\/upload/);
  assert.match(field, /Browse media/);
  assert.doesNotMatch(field, /readAsDataURL|data:image/);
});
