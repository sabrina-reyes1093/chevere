import { Buffer } from "node:buffer";
import { config } from "./config.ts";

export type FileJumpFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  folderId: string | null;
  raw: Record<string, unknown>;
};

export class FileJumpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FileJumpError";
    this.status = status;
  }
}

function xmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagText(block: string, tag: string) {
  const match = block.match(new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, "i"));
  return match ? xmlText(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function pathSegments(path: string) {
  const segments = path.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new FileJumpError("FileJump paths cannot contain dot segments.", 500);
  }
  return segments;
}

function encodePath(path: string) {
  return pathSegments(path).map(encodeURIComponent).join("/");
}

function basePathname() {
  return decodeURIComponent(new URL(config.fileJumpWebDavUrl).pathname).replace(/\/$/, "");
}

function relativePath(href: string) {
  const pathname = decodeURIComponent(new URL(href, config.fileJumpWebDavUrl).pathname);
  const base = basePathname();
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).replace(/\/$/, "") : "";
}

function requestUrl(path = "") {
  const base = new URL(config.fileJumpWebDavUrl);
  if (base.protocol !== "https:") throw new FileJumpError("FileJump WebDAV must use HTTPS.", 500);
  const resolved = new URL(encodePath(path), base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) {
    throw new FileJumpError("FileJump path escaped the configured WebDAV root.", 500);
  }
  return resolved.toString();
}

function publicMediaUrl(assetId?: string) {
  return assetId ? `${config.newsletterUrl.replace(/\/$/, "")}/api/media/filejump/${encodeURIComponent(assetId)}` : "";
}

export function normalizeFileJumpList(xml: string, assetIds: Record<string, string> = {}) {
  const responses = xml.match(/<(?:[A-Za-z][\w.-]*:)?response\b[\s\S]*?<\/(?:[A-Za-z][\w.-]*:)?response>/gi) || [];
  return responses.flatMap((block): FileJumpFile[] => {
    const href = tagText(block, "href");
    const id = href ? relativePath(href) : "";
    const isCollection = /<(?:[A-Za-z][\w.-]*:)?collection\b/i.test(block);
    if (!id || isCollection) return [];
    const name = tagText(block, "displayname") || id.split("/").pop() || id;
    const folderId = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : null;
    return [{
      id,
      name,
      size: Number(tagText(block, "getcontentlength")) || 0,
      mimeType: tagText(block, "getcontenttype") || "application/octet-stream",
      url: publicMediaUrl(assetIds[id]),
      folderId,
      raw: {
        href,
        etag: tagText(block, "getetag"),
        last_modified: tagText(block, "getlastmodified"),
      },
    }];
  });
}

async function fileJumpRequest(path: string, init: RequestInit = {}, allowedStatuses: number[] = []) {
  if (!config.fileJumpConfigured) throw new FileJumpError("FileJump is not configured.", 503);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Basic ${Buffer.from(`${config.fileJumpUsername}:${config.fileJumpPassword}`).toString("base64")}`);
  const response = await fetch(requestUrl(path), {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(20_000),
  });
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new FileJumpError(detail || `FileJump request failed (${response.status}).`, response.status);
  }
  return response;
}

async function ensureFileJumpFolder() {
  const folder = configuredFolder();
  if (!folder) return;
  await fileJumpRequest(folder, { method: "MKCOL" }, [405]);
}

function configuredFolder() {
  const folder = config.fileJumpFolder;
  if (folder && (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(folder) || folder === "." || folder === "..")) {
    throw new FileJumpError("FILEJUMP_FOLDER must be one safe folder name.", 500);
  }
  return folder;
}

function uniqueRemoteName(name: string, stableId = crypto.randomUUID()) {
  const cleaned = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  return `${stableId}-${cleaned}`;
}

export async function uploadFileJumpFile(file: File, assetId: string) {
  await ensureFileJumpFolder();
  const id = [configuredFolder(), uniqueRemoteName(file.name, assetId)].filter(Boolean).join("/");
  await fileJumpRequest(id, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  const uploaded = await getFileJumpFile(id, assetId);
  return { ...uploaded, name: file.name, size: file.size, mimeType: file.type };
}

export async function listFileJumpFiles(assetIds: Record<string, string> = {}) {
  await ensureFileJumpFolder();
  const response = await fileJumpRequest(configuredFolder(), {
    method: "PROPFIND",
    headers: { Depth: "1" },
  }, [207]);
  return normalizeFileJumpList(await response.text(), assetIds);
}

export async function getFileJumpFile(id: string, assetId?: string) {
  const response = await fileJumpRequest(id, {
    method: "PROPFIND",
    headers: { Depth: "0" },
  }, [207]);
  const [file] = normalizeFileJumpList(await response.text(), assetId ? { [id]: assetId } : {});
  if (!file) throw new FileJumpError("FileJump file not found.", 404);
  return file;
}

export async function deleteFileJumpFile(id: string) {
  await fileJumpRequest(id, { method: "DELETE" }, [204]);
}

export async function downloadFileJumpFile(id: string) {
  return fileJumpRequest(id, { method: "GET", signal: AbortSignal.timeout(60_000) });
}
