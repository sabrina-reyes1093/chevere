import { load } from "cheerio";

import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase-admin";

export type FeaturedReadArticle = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  image_url: string;
  image_alt: string;
  url: string;
  published_on: string;
};

export type FeaturedRead = FeaturedReadArticle & {
  display_order: number;
};

export async function loadPublishedArticles({ fresh = false }: { fresh?: boolean } = {}) {
  const response = await fetch(
    `${config.siteUrl}/blog.html`,
    fresh ? { cache: "no-store" } : { next: { revalidate: 300 } },
  );
  if (!response.ok) throw new Error("Unable to load published articles.");

  const $ = load(await response.text());
  return $(".post-card").map((_, element): FeaturedReadArticle => {
    const card = $(element);
    const href = card.attr("href") || "";
    const slug = href.split("/").pop()?.replace(/\.html$/, "") || "";
    const style = card.find(".thumb").attr("style") || "";
    const image = style.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1] || "";
    const title = card.find("h2").text().trim();
    return {
      slug,
      title,
      category: card.find(".kicker").text().trim(),
      excerpt: card.find(".dek").text().trim(),
      image_url: image ? new URL(image, `${config.siteUrl}/`).toString() : "",
      image_alt: title,
      url: new URL(href || "blog.html", `${config.siteUrl}/`).toString(),
      published_on: card.find(".date").text().trim(),
    };
  }).get().filter((article) => article.slug && article.title && article.image_url);
}

export async function loadFeaturedReads(): Promise<FeaturedRead[]> {
  // The homepage reflects the manual admin selection stored in the database.
  // The admin editor's "Order by newest published" button fills those slots
  // automatically, but the saved selection is always the source of truth.
  const { data, error } = await createAdminClient()
    .from("homepage_featured_reads")
    .select("display_order,post_slug")
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);

  const articles = await loadPublishedArticles();
  return (data || []).flatMap((row) => {
    const article = articles.find((item) => item.slug === row.post_slug);
    return article ? [{ ...article, display_order: Number(row.display_order) }] : [];
  });
}
