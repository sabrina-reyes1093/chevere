import { config } from "@/lib/config";
import { deleteFileJumpFile, listFileJumpFiles, uploadFileJumpFile, type FileJumpFile } from "@/lib/filejump";
import { loadHomepageRoundupStrict } from "@/lib/homepage-roundup";
import { createAdminClient } from "@/lib/supabase-admin";

const BUCKET = "newsletter-images";
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

function normalizedMediaType(file: Pick<FileJumpFile, "name" | "mimeType">) {
  const declared = file.mimeType.toLowerCase().split(";", 1)[0];
  return MEDIA_EXTENSIONS[declared] ? declared : "";
}

function assetIdFromProviderFileId(providerFileId: string) {
  const name = providerFileId.split("/").pop() || "";
  return name.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-/i)?.[1];
}

function fileJumpRow(file: FileJumpFile, assetId: string) {
  return {
    id: assetId,
    provider: "filejump" as const,
    provider_file_id: file.id,
    provider_folder_id: file.folderId,
    file_name: file.name,
    display_name: file.name,
    url: file.url,
    mime_type: file.mimeType,
    size_bytes: file.size,
    metadata: file.raw,
  };
}

export async function uploadMediaAsset(file: File, createdBy?: string) {
  const extension = MEDIA_EXTENSIONS[file.type];
  if (!extension) throw new Error("Use a PNG, JPEG, GIF, WebP, HEIC, HEIF, or AVIF image.");
  if (file.size > MAX_MEDIA_BYTES) throw new Error("Images must be 5 MB or smaller.");

  const db = createAdminClient();
  if (config.fileJumpConfigured) {
    const assetId = crypto.randomUUID();
    const uploaded = await uploadFileJumpFile(file, assetId);
    const { data, error } = await db.from("media_assets")
      .upsert({ ...fileJumpRow(uploaded, assetId), created_by: createdBy || null }, { onConflict: "provider,provider_file_id" })
      .select("*").single();
    if (error) {
      throw new Error(`FileJump uploaded the image, but the media record could not be saved. Reopen the library to synchronize it: ${error.message}`);
    }
    return data;
  }

  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = db.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await db.from("media_assets").insert({
    provider: "supabase",
    provider_file_id: path,
    provider_folder_id: BUCKET,
    file_name: file.name,
    display_name: file.name,
    url: publicData.publicUrl,
    mime_type: file.type,
    size_bytes: file.size,
    metadata: { bucket: BUCKET, path },
    created_by: createdBy || null,
  }).select("*").single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw new Error(`The image uploaded, but the media record could not be saved: ${error.message}`);
  }
  return data;
}

export async function syncFileJumpAssets() {
  if (!config.fileJumpConfigured) return;
  const db = createAdminClient();
  const { data: existing, error } = await db.from("media_assets")
    .select("id,provider_file_id,display_name,alt_text,url,metadata")
    .eq("provider", "filejump");
  if (error) throw new Error(error.message);
  const byId = new Map((existing || []).map((asset) => [asset.provider_file_id, asset]));
  const assetIds = Object.fromEntries((existing || []).map((asset) => [asset.provider_file_id, asset.id]));
  const files = (await listFileJumpFiles(assetIds)).flatMap((file) => {
    const mimeType = normalizedMediaType(file);
    return mimeType && file.size > 0 && file.size <= MAX_MEDIA_BYTES ? [{ ...file, mimeType }] : [];
  });
  const claimedAssetIds = new Map((existing || []).map((asset) => [asset.id, asset.provider_file_id]));
  const rows = files.map((file) => {
    const current = byId.get(file.id);
    const embeddedId = assetIdFromProviderFileId(file.id);
    const assetId = current?.id || (embeddedId && !claimedAssetIds.has(embeddedId) ? embeddedId : crypto.randomUUID());
    claimedAssetIds.set(assetId, file.id);
    return {
      ...fileJumpRow({
        ...file,
        url: `${config.newsletterUrl.replace(/\/$/, "")}/api/media/filejump/${assetId}`,
      }, assetId),
      display_name: current?.display_name || file.name,
      alt_text: current?.alt_text || "",
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error: upsertError } = await db.from("media_assets")
      .upsert(rows, { onConflict: "provider,provider_file_id" });
    if (upsertError) throw new Error(upsertError.message);
  }

  const remoteIds = new Set(files.map((file) => file.id));
  const missingAssets = (existing || []).filter((asset) => !remoteIds.has(asset.provider_file_id));
  const usagesByUrl = await findMediaUsages(missingAssets.map((asset) => asset.url));
  for (const missing of missingAssets) {
    const usages = usagesByUrl.get(missing.url) || [];
    if (usages.length) {
      const { error: missingError } = await db.from("media_assets").update({
        metadata: { ...(missing.metadata || {}), remote_missing: true },
        updated_at: new Date().toISOString(),
      }).eq("id", missing.id);
      if (missingError) throw new Error(missingError.message);
    } else {
      const { error: deleteError } = await db.from("media_assets").delete().eq("id", missing.id);
      if (deleteError) throw new Error(deleteError.message);
    }
  }
}

export async function deleteProviderAsset(asset: { provider: string; provider_file_id: string; provider_folder_id?: string | null }) {
  if (asset.provider === "filejump") {
    await deleteFileJumpFile(asset.provider_file_id);
    return;
  }
  if (asset.provider === "supabase") {
    const bucket = asset.provider_folder_id || BUCKET;
    const { error } = await createAdminClient().storage.from(bucket).remove([asset.provider_file_id]);
    if (error) throw new Error(error.message);
  }
}

type MediaUsage = { type: string; id: string; label: string };

export async function findMediaUsages(urls: string[]) {
  const db = createAdminClient();
  const targets = [...new Set(urls.filter(Boolean))];
  const usages = new Map(targets.map((url) => [url, [] as MediaUsage[]]));
  if (!targets.length) return usages;
  const [
    { data: posts, error: postError },
    { data: issues, error: issueError },
    { data: snapshots, error: snapshotError },
    homepageRoundup,
  ] = await Promise.all([
    db.from("blog_posts").select("id,slug,title,cover_image_url,hero_image_url,body"),
    db.from("newsletter_issues").select("id,title,featured_image_url,roundup_items,roundup_snapshot"),
    db.from("newsletter_issue_snapshots").select("id,issue_id,issue_payload,rendered_html"),
    loadHomepageRoundupStrict(),
  ]);
  if (postError) throw new Error(postError.message);
  if (issueError) throw new Error(issueError.message);
  if (snapshotError) throw new Error(snapshotError.message);

  for (const post of posts || []) {
    for (const url of targets) {
      if (post.cover_image_url === url || post.hero_image_url === url || String(post.body || "").includes(url)) {
        usages.get(url)?.push({ type: "post", id: post.id, label: post.title || post.slug });
      }
    }
  }
  for (const issue of issues || []) {
    const roundups = `${JSON.stringify(issue.roundup_items || [])}${JSON.stringify(issue.roundup_snapshot || [])}`;
    for (const url of targets) {
      if (issue.featured_image_url === url || roundups.includes(url)) {
        usages.get(url)?.push({ type: "issue", id: issue.id, label: issue.title || "Newsletter issue" });
      }
    }
  }
  for (const snapshot of snapshots || []) {
    const snapshotContent = `${JSON.stringify(snapshot.issue_payload || {})}${String(snapshot.rendered_html || "")}`;
    for (const url of targets) {
      if (snapshotContent.includes(url)) {
        usages.get(url)?.push({ type: "sent_issue", id: snapshot.id, label: `Sent newsletter ${snapshot.issue_id}` });
      }
    }
  }
  for (const [index, card] of (homepageRoundup?.cards || []).entries()) {
    if (usages.has(card.image_url)) usages.get(card.image_url)?.push({ type: "homepage_roundup", id: `card-${index + 1}`, label: `Homepage roundup card ${index + 1}` });
  }
  return usages;
}

export async function findMediaUsage(url: string) {
  return (await findMediaUsages([url])).get(url) || [];
}
