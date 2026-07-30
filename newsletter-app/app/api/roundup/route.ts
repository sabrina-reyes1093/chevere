import { NextResponse } from "next/server";

import { loadHomepageRoundup, isHomepageRoundupReady } from "@/lib/homepage-roundup";
import { fromDbRow, normalizeRoundupTitle } from "@/lib/issue-mapper";
import { validateRoundupForPublication } from "@/lib/issue-schema";
import { createAdminClient } from "@/lib/supabase-admin";
import type { RoundupItem } from "@/lib/types";

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
  // The dedicated homepage Weekly Roundup editor takes precedence. When it is
  // enabled and complete, it drives the homepage independently of newsletter
  // issues; otherwise we fall back to the newest eligible issue below.
  try {
    const roundup = await loadHomepageRoundup();
    if (roundup.enabled && isHomepageRoundupReady(roundup)) {
      const cards = roundup.cards.map((card, index) => ({
        ...card,
        id: `homepage-roundup-${index + 1}`,
        display_order: index + 1,
        title: normalizeRoundupTitle(card.title),
      }));
      return NextResponse.json(
        { issue: { id: "homepage-roundup", title: "This Week at Chévere", issue_date: "", publish_at: new Date().toISOString(), cards } },
        { headers: { ...cors, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
      );
    }
  } catch (roundupError) {
    console.error("Unable to load the standalone homepage roundup; falling back to newsletter issues.", roundupError);
  }

  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("newsletter_issues")
    .select("*")
    .in("roundup_status", ["published", "scheduled"])
    .lte("homepage_publish_at", now)
    .order("homepage_publish_at", { ascending: false })
    .limit(20);

  // Before migration 009 is applied there is intentionally no public roundup.
  if (error) {
    console.error("Unable to resolve the homepage weekly roundup.", { code: error.code, message: error.message });
    return NextResponse.json({ issue: null }, { headers: { ...cors, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  }

  for (const row of data || []) {
    const issue = fromDbRow(row as Record<string, unknown>);
    const snapshot = Array.isArray(row.roundup_snapshot) ? row.roundup_snapshot as RoundupItem[] : null;
    const candidate = snapshot ? { ...issue, roundup_items: snapshot } : issue;
    if (validateRoundupForPublication(candidate)) continue;
    const cards = candidate.roundup_items
      .slice()
      .sort((a: RoundupItem, b: RoundupItem) => a.display_order - b.display_order)
      .map((item: RoundupItem) => ({ ...item, title: normalizeRoundupTitle(item.title) }));
    return NextResponse.json({
      issue: {
        id: row.id,
        title: issue.title,
        issue_date: issue.issue_date,
        publish_at: row.homepage_publish_at,
        cards,
      },
    }, { headers: { ...cors, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  }

  return NextResponse.json({ issue: null }, { headers: { ...cors, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
