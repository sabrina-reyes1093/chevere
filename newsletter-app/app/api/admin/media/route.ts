import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getAdminUser, requireAdminApi } from "@/lib/auth";
import { MAX_MEDIA_BYTES, MEDIA_EXTENSIONS, syncFileJumpAssets, uploadMediaAsset } from "@/lib/media-assets";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    let warning = "";
    if (request.nextUrl.searchParams.get("sync") === "1") {
      try { await syncFileJumpAssets(); }
      catch (syncError) { warning = syncError instanceof Error ? syncError.message : "FileJump synchronization failed."; }
    }
    const { data, error } = await createAdminClient().from("media_assets")
      .select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return NextResponse.json({ assets: data || [], provider: config.fileJumpConfigured ? "filejump" : "supabase", filejump_configured: config.fileJumpConfigured, warning });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load the media library." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an image to upload." }, { status: 400 });
  if (!MEDIA_EXTENSIONS[file.type]) return NextResponse.json({ error: "Use a PNG, JPEG, GIF, WebP, HEIC, HEIF, or AVIF image." }, { status: 400 });
  if (file.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });
  try {
    const user = await getAdminUser();
    const asset = await uploadMediaAsset(file, user?.id);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 502 });
  }
}
