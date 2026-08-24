import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { FileJumpError, getFileJumpFile } from "@/lib/filejump";
import { deleteProviderAsset, findMediaUsage } from "@/lib/media-assets";
import { mediaAssetUpdateSchema } from "@/lib/media-schema";
import { createAdminClient } from "@/lib/supabase-admin";

async function assetById(id: string) {
  return createAdminClient().from("media_assets").select("*").eq("id", id).maybeSingle();
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const { data, error } = await assetById(id);
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
    if (data.provider === "filejump") {
      const remote = await getFileJumpFile(data.provider_file_id, data.id);
      const { data: refreshed, error: refreshError } = await createAdminClient().from("media_assets").update({
        file_name: remote.name,
        url: remote.url,
        mime_type: remote.mimeType,
        size_bytes: remote.size,
        provider_folder_id: remote.folderId,
        metadata: remote.raw,
        updated_at: new Date().toISOString(),
      }).eq("id", id).select("*").single();
      if (refreshError) throw new Error(refreshError.message);
      return NextResponse.json(refreshed);
    }
    return NextResponse.json(data);
  } catch (readError) {
    const status = readError instanceof FileJumpError && readError.status === 404 ? 404 : readError instanceof FileJumpError ? 502 : 500;
    return NextResponse.json({ error: status === 404 ? "Media asset not found." : readError instanceof Error ? readError.message : "Could not load the media asset." }, { status });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = mediaAssetUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the media fields.", details: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  const { data: asset, error: readError } = await assetById(id);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  try {
    const { data, error } = await createAdminClient().from("media_assets").update({
      display_name: parsed.data.display_name,
      alt_text: parsed.data.alt_text,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof FileJumpError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the media asset." }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { data: asset, error: readError } = await assetById(id);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  try {
    const usages = await findMediaUsage(asset.url);
    if (usages.length) return NextResponse.json({ error: "Remove this image from existing content before deleting it.", usages }, { status: 409 });
    try {
      await deleteProviderAsset(asset);
    } catch (error) {
      if (!(error instanceof FileJumpError) || error.status !== 404) throw error;
    }
    const { error } = await createAdminClient().from("media_assets").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof FileJumpError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete the media asset." }, { status });
  }
}
