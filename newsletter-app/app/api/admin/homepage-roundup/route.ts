import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { homepageRoundupSchema, isHomepageRoundupReady, loadHomepageRoundup, saveHomepageRoundup } from "@/lib/homepage-roundup";

export async function GET() {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadHomepageRoundup());
}

export async function PUT(request: Request) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = homepageRoundupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the roundup fields.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Only block enabling an incomplete roundup; a disabled draft can be saved freely.
  if (parsed.data.enabled && !isHomepageRoundupReady(parsed.data)) {
    return NextResponse.json(
      { error: "Each of the three cards needs an image, alt text, title, and a valid, unique destination URL before showing on the homepage." },
      { status: 400 },
    );
  }

  await saveHomepageRoundup(parsed.data);
  return NextResponse.json({ ok: true });
}
