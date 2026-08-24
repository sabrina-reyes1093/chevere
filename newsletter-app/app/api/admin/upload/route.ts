import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, requireAdminApi } from "@/lib/auth";
import { MAX_MEDIA_BYTES as MAX_BYTES, MEDIA_EXTENSIONS as EXTENSIONS, uploadMediaAsset } from "@/lib/media-assets";

export async function POST(request: NextRequest) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an image to upload." }, { status: 400 });

  const extension = EXTENSIONS[file.type];
  if (!extension) return NextResponse.json({ error: "Use a PNG, JPEG, GIF, WebP, HEIC, HEIF, or AVIF image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });

  try {
    const user = await getAdminUser();
    const asset = await uploadMediaAsset(file, user?.id);
    return NextResponse.json({ url: asset.url, asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 502 });
  }
}
