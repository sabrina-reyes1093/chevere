import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { loadPublishedArticles } from "@/lib/featured-reads";
import { loadSiteContent, saveSiteContent, siteContentSchema } from "@/lib/site-content";

export async function GET() {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadSiteContent());
}

export async function PUT(request: Request) {
  if (!await requireAdminApi()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = siteContentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the homepage content fields.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const publishedArticles = await loadPublishedArticles({ fresh: true });
  const publishedSlugs = new Set(publishedArticles.map((article) => article.slug));
  if (parsed.data.seasonal_banner.post_slugs.some((slug) => !publishedSlugs.has(slug))) {
    return NextResponse.json(
      { error: "Every seasonal selection must be a published article." },
      { status: 400 },
    );
  }

  await saveSiteContent(parsed.data);
  return NextResponse.json({ ok: true });
}
