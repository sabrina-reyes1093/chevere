import { NextRequest, NextResponse } from "next/server";
import { downloadFileJumpFile, FileJumpError } from "@/lib/filejump";
import { MAX_MEDIA_BYTES, MEDIA_EXTENSIONS } from "@/lib/media-assets";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  }

  const { data: asset, error } = await createAdminClient().from("media_assets")
    .select("provider_file_id,mime_type")
    .eq("id", id)
    .eq("provider", "filejump")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Media storage is temporarily unavailable." }, { status: 503 });
  if (!asset) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  const mimeType = String(asset.mime_type || "").toLowerCase().split(";", 1)[0];
  if (!MEDIA_EXTENSIONS[mimeType]) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });

  try {
    const remote = await downloadFileJumpFile(asset.provider_file_id);
    const contentLength = Number(remote.headers.get("content-length"));
    if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_MEDIA_BYTES) {
      return NextResponse.json({ error: "Media asset is temporarily unavailable." }, { status: 502 });
    }
    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=60");
    headers.set("X-Content-Type-Options", "nosniff");
    for (const name of ["content-length", "etag", "last-modified"]) {
      const value = remote.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(remote.body, { status: 200, headers });
  } catch (remoteError) {
    const status = remoteError instanceof FileJumpError && remoteError.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Media asset not found." : "Media asset is temporarily unavailable." }, { status });
  }
}
