import { load } from "cheerio";

import { config } from "@/lib/config";

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

export async function loadPublishedArticles() {
  const response = await fetch(`${config.siteUrl}/blog.html`, { next: { revalidate: 300 } });
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
  const articles = await loadPublishedArticles();

  // Sort by publication date in reverse chronological order (newest first)
  const sorted = [...articles].sort((a, b) => {
    const dateA = new Date(a.published_on).getTime();
    const dateB = new Date(b.published_on).getTime();
    return dateB - dateA; // Newest first
  });

  // Return the 3 newest posts with display_order
  return sorted.slice(0, 3).map((article, index) => ({
    ...article,
    display_order: index + 1,
  }));
}
