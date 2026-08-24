import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { monthLabel } from "@/lib/post-schema";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET() {
  const { data, error } = await createAdminClient()
    .from("blog_posts")
    .select("slug,title,dek,cover_image_url,category,series_month,series_year,published_on,author,featured_on_homepage")
    .eq("status", "published")
    .eq("series", "the-month-ahead")
    .order("series_year", { ascending: false })
    .order("series_month", { ascending: false })
    .order("published_on", { ascending: false })
    .limit(24);

  if (error) {
    console.error("Unable to load The Month Ahead.", { code: error.code, message: error.message });
    return NextResponse.json({ item: null }, { headers: { ...cors, "Cache-Control": "public, max-age=60" } });
  }

  // An explicit homepage selection can pin an edition; otherwise the newest
  // published Month Ahead post is selected automatically.
  const selected = (data || []).find((post) => post.featured_on_homepage) || data?.[0];
  const item = selected ? {
    slug: selected.slug,
    title: selected.title,
    excerpt: selected.dek,
    image_url: selected.cover_image_url,
    category: selected.category,
    month: monthLabel(selected.series_month),
    year: selected.series_year,
    published_on: selected.published_on,
    author: selected.author,
    url: `${config.siteUrl}/posts/${selected.slug}.html`,
  } : null;

  return NextResponse.json(
    { item },
    { headers: { ...cors, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
