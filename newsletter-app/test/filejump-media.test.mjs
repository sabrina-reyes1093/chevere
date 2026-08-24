import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  deleteFileJumpFile,
  downloadFileJumpFile,
  listFileJumpFiles,
  normalizeFileJumpList,
  uploadFileJumpFile,
} from "../lib/filejump.ts";
import { mediaAssetUpdateSchema } from "../lib/media-schema.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

test("media metadata updates require a name and permit reusable alt text", () => {
  assert.equal(mediaAssetUpdateSchema.safeParse({ display_name: "September cover.jpg", alt_text: "Books and coffee on a desk" }).success, true);
  assert.equal(mediaAssetUpdateSchema.safeParse({ display_name: "", alt_text: "" }).success, false);
});

test("the media schema stores FileJump provider identity separately from public URLs", () => {
  const migration = read("supabase/migrations/013_filejump_media.sql");
  for (const field of ["provider", "provider_file_id", "provider_folder_id", "file_name", "display_name", "url", "mime_type", "size_bytes", "alt_text", "metadata"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.match(migration, /unique \(provider, provider_file_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all.*anon, authenticated/);
});

test("FileJump WebDAV configuration remains server-only and supports a dedicated folder", () => {
  const config = read("lib/config.ts");
  const example = read(".env.example");
  assert.match(config, /FILEJUMP_WEBDAV_URL/);
  assert.match(config, /FILEJUMP_USERNAME/);
  assert.match(config, /FILEJUMP_PASSWORD/);
  assert.match(config, /FILEJUMP_FOLDER/);
  assert.doesNotMatch(config, /NEXT_PUBLIC_FILEJUMP/);
  assert.match(example, /FILEJUMP_PASSWORD=/);
});

test("the FileJump client implements provider storage operations", () => {
  const client = read("lib/filejump.ts");
  assert.match(client, /uploadFileJumpFile/);
  assert.match(client, /listFileJumpFiles/);
  assert.match(client, /getFileJumpFile/);
  assert.match(client, /deleteFileJumpFile/);
  assert.match(client, /Authorization.*Basic/);
  assert.match(client, /method: "PROPFIND"/);
  assert.match(client, /method: "DELETE"/);
  assert.match(client, /AbortSignal\.timeout/);
});

test("the FileJump WebDAV client performs authenticated CRUD and returns stable public URLs", async () => {
  const previous = {
    url: process.env.FILEJUMP_WEBDAV_URL,
    username: process.env.FILEJUMP_USERNAME,
    password: process.env.FILEJUMP_PASSWORD,
    folder: process.env.FILEJUMP_FOLDER,
    newsletter: process.env.NEXT_PUBLIC_NEWSLETTER_URL,
    fetch: globalThis.fetch,
  };
  process.env.FILEJUMP_WEBDAV_URL = "https://uploads.example.test/dav/ws/";
  process.env.FILEJUMP_USERNAME = "editor@example.test";
  process.env.FILEJUMP_PASSWORD = "server-only-secret";
  process.env.FILEJUMP_FOLDER = "chevere-media";
  process.env.NEXT_PUBLIC_NEWSLETTER_URL = "https://newsletter.example.test";

  const calls = [];
  const fileXml = (href, displayName = decodeURIComponent(href.split("/").pop())) => `<?xml version="1.0"?>
    <D:multistatus xmlns:D="DAV:"><D:response><D:href>${href}</D:href><D:propstat><D:prop>
    <D:displayname>${displayName}</D:displayname><D:getcontentlength>3</D:getcontentlength>
    <D:getcontenttype>image/png</D:getcontenttype><D:getetag>etag-1</D:getetag>
    </D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`;

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const headers = new Headers(init.headers);
    calls.push({ url, method, headers });
    assert.match(headers.get("authorization") || "", /^Basic /);
    assert.doesNotMatch(url, /server-only-secret/);
    if (method === "MKCOL") return new Response("Folder exists", { status: 405 });
    if (method === "PUT") return new Response(null, { status: 201 });
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method === "GET") return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } });
    const href = new URL(url).pathname;
    return new Response(fileXml(href), { status: 207, headers: { "Content-Type": "application/xml" } });
  };

  try {
    const assetId = "2bb95936-e6c8-4d71-a743-286e73061554";
    const file = new File([new Uint8Array([1, 2, 3])], "Cover Photo.png", { type: "image/png" });
    const uploaded = await uploadFileJumpFile(file, assetId);
    assert.match(uploaded.id, /^chevere-media\/[0-9a-f-]+-Cover-Photo\.png$/);
    assert.equal(uploaded.name, "Cover Photo.png");
    assert.equal(uploaded.url, `https://newsletter.example.test/api/media/filejump/${assetId}`);

    const listed = await listFileJumpFiles({ [uploaded.id]: assetId });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].mimeType, "image/png");

    const downloaded = await downloadFileJumpFile(uploaded.id);
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), new Uint8Array([1, 2, 3]));
    await deleteFileJumpFile(uploaded.id);
    assert.deepEqual(calls.map((call) => call.method), ["MKCOL", "PUT", "PROPFIND", "MKCOL", "PROPFIND", "GET", "DELETE"]);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({
      FILEJUMP_WEBDAV_URL: previous.url,
      FILEJUMP_USERNAME: previous.username,
      FILEJUMP_PASSWORD: previous.password,
      FILEJUMP_FOLDER: previous.folder,
      NEXT_PUBLIC_NEWSLETTER_URL: previous.newsletter,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("the WebDAV response parser ignores collections", () => {
  const previousUrl = process.env.FILEJUMP_WEBDAV_URL;
  process.env.FILEJUMP_WEBDAV_URL = "https://uploads.example.test/dav/ws/";
  try {
    const parsed = normalizeFileJumpList(`<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">
      <D:response><D:href>/dav/ws/chevere-media/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>
      <D:response><D:href>/dav/ws/chevere-media/cover.png</D:href><D:propstat><D:prop><D:displayname>cover.png</D:displayname><D:getcontentlength>12</D:getcontentlength><D:getcontenttype>image/png</D:getcontenttype></D:prop></D:propstat></D:response>
    </D:multistatus>`);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, "chevere-media/cover.png");
    assert.equal(parsed[0].size, 12);
  } finally {
    if (previousUrl === undefined) delete process.env.FILEJUMP_WEBDAV_URL;
    else process.env.FILEJUMP_WEBDAV_URL = previousUrl;
  }
});

test("FileJump files are served from stable public URLs without exposing WebDAV credentials", () => {
  const route = read("app/api/media/filejump/[id]/route.ts");
  const media = read("lib/media-assets.ts");
  assert.match(route, /downloadFileJumpFile/);
  assert.match(route, /provider_file_id/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /FILEJUMP_PASSWORD|Authorization/);
  assert.match(media, /\/api\/media\/filejump\//);
});

test("admin media routes are authenticated and expose full CRUD", () => {
  const collection = read("app/api/admin/media/route.ts");
  const member = read("app/api/admin/media/[id]/route.ts");
  assert.match(collection, /export async function GET/);
  assert.match(collection, /export async function POST/);
  assert.match(member, /export async function GET/);
  assert.match(member, /export async function PUT/);
  assert.match(member, /export async function DELETE/);
  assert.match(collection, /requireAdminApi/);
  assert.match(member, /requireAdminApi/);
  assert.match(member, /findMediaUsage/);
  assert.match(member, /status: 409/);
});

test("the shared inline image field opens the CRUD media library", () => {
  const field = read("components/image-field.tsx");
  const library = read("components/media-library-dialog.tsx");
  const postEditor = read("components/post-editor.tsx");
  assert.match(field, /MediaLibraryDialog/);
  assert.match(library, /\/api\/admin\/media\?sync=1/);
  assert.match(library, /method: "POST"/);
  assert.match(library, /method: "PUT"/);
  assert.match(library, /method: "DELETE"/);
  assert.match(postEditor, /Browse media/);
  assert.match(postEditor, /insertAsset/);
});
