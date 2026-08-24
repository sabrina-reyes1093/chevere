import fs from "node:fs/promises";
import path from "node:path";
import { renderPostPage } from "@/lib/post-template";
import { categoryLabels, categorySections, displayDate, normalizePostCategories, seriesEditionLabel, type PostInput } from "@/lib/post-schema";

/** The site repo is the parent of the newsletter app. */
export function siteRoot() {
  return path.resolve(process.cwd(), "..");
}

function escapeAttr(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] || char));
}

/** One card in the #post-grid of blog.html, matching the hand-written ones. */
export function cardMarkup(post: PostInput) {
  const categories = normalizePostCategories(post.category, post.slug);
  const href = `posts/${escapeAttr(post.slug)}.html`;
  const series = post.series || "";
  const seriesMeta = seriesEditionLabel(post);
  const organization = [
    `data-series="${escapeAttr(series)}"`,
    `data-series-month="${escapeAttr(post.series_month || "")}"`,
    `data-series-year="${escapeAttr(post.series_year || "")}"`,
    `data-series-season="${escapeAttr(post.series_season || "")}"`,
    `data-series-issue="${escapeAttr(post.series_issue_number || "")}"`,
    `data-series-date="${escapeAttr(post.series_edition_date || "")}"`,
    `data-show-latest="${post.show_in_latest !== false}"`,
    `data-show-series="${post.show_in_series_section !== false}"`,
  ].join(" ");
  if (categories.includes("introduction")) {
    return `      <article class="post-card featured" data-cat="" data-section="" data-featured="true" data-url="${href}">
        <a class="featured-card-link" href="${href}" aria-label="Read ${escapeAttr(post.title)}"></a>
        <div class="featured-media">
          <img class="featured-image" src="${escapeAttr(post.cover_image_url)}" alt="" />
        </div>
        <div class="featured-copy">
          <div class="featured-copy-main">
            <span class="kicker">${escapeAttr(categoryLabels(post.category, post.slug))}</span>
            <h2>${escapeAttr(post.title)}</h2>
            <p class="dek">${escapeAttr(post.dek)}</p>
          </div>
          <div class="featured-meta-row">
            <time class="date" datetime="${escapeAttr(post.published_on)}">${escapeAttr(displayDate(post.published_on))}</time>
            <span class="featured-meta-separator" aria-hidden="true">&middot;</span>
            <a class="featured-read-more" href="${href}">Read More <span aria-hidden="true">&rarr;</span></a>
          </div>
        </div>
      </article>`;
  }
  return `      <a class="post-card" data-cat="${escapeAttr(categories.join(" "))}" data-section="${escapeAttr(categorySections(post.category, post.slug).join(" "))}" ${organization} href="${href}">
        <div class="thumb" style="background-image:url(${escapeAttr(post.cover_image_url)});background-size:cover;background-position:center"></div>
        ${seriesMeta ? `<span class="series-label">${escapeAttr(seriesMeta)}</span>` : ""}
        <span class="kicker">${escapeAttr(categoryLabels(post.category, post.slug))}</span>
        <h2>${escapeAttr(post.title)}</h2>
        <p class="dek">${escapeAttr(post.dek)}</p>
        <p class="date">${escapeAttr(displayDate(post.published_on))}</p>
      </a>`;
}

/** Replaces an existing card for this slug, or inserts a new one at the top of
 *  the grid. Everything outside the touched card is left byte-for-byte intact,
 *  which a full parse-and-reserialize would not guarantee. */
export function upsertCard(html: string, post: PostInput) {
  const href = `posts/${post.slug}.html`;
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = new RegExp(
    `[ \\t]*(?:<article class="[^"]*post-card[^"]*"[^>]*data-url="${escapedHref}"[\\s\\S]*?<\\/article>|<a class="[^"]*post-card[^"]*"[^>]*href="${escapedHref}"[\\s\\S]*?<\\/a>)`
  );
  const hasExisting = existing.test(html);
  if (normalizePostCategories(post.category, post.slug).includes("introduction")) {
    return { html: removeCard(html, post.slug), action: "updated" as const };
  }
  if (hasExisting) {
    return { html: html.replace(existing, cardMarkup(post)), action: "updated" as const };
  }

  const gridOpen = html.indexOf('<div class="post-grid" id="post-grid">');
  if (gridOpen === -1) throw new Error('Could not find <div class="post-grid" id="post-grid"> in blog.html.');
  let insertAt = html.indexOf(">", gridOpen) + 1;
  if (!normalizePostCategories(post.category, post.slug).includes("introduction")) {
    const featured = html.slice(insertAt).match(/\n[ \t]*<article class="[^"]*post-card[^"]*featured[^"]*"[^>]*data-featured="true"[\s\S]*?<\/article>/);
    if (featured?.index === 0) insertAt += featured[0].length;
  }
  return {
    html: html.slice(0, insertAt) + "\n" + cardMarkup(post) + html.slice(insertAt),
    action: "inserted" as const,
  };
}

export type PublishResult = {
  postFile: string;
  cardAction: "inserted" | "updated";
  siteRoot: string;
};

/** Writes posts/<slug>.html and adds or refreshes the card in blog.html. */
export async function publishPost(post: PostInput): Promise<PublishResult> {
  const root = siteRoot();
  const blogPath = path.join(root, "blog.html");

  let blogHtml: string;
  try {
    blogHtml = await fs.readFile(blogPath, "utf8");
  } catch {
    throw new Error(`Could not read ${blogPath}. Publishing writes files directly, so the admin app has to be running from inside the site repo.`);
  }

  const postsDir = path.join(root, "posts");
  await fs.mkdir(postsDir, { recursive: true });
  const postFile = path.join(postsDir, `${post.slug}.html`);
  await fs.writeFile(postFile, renderPostPage(post), "utf8");

  const { html, action } = upsertCard(blogHtml, post);
  await fs.writeFile(blogPath, html, "utf8");

  return { postFile: path.relative(root, postFile), cardAction: action, siteRoot: root };
}

/** Strips a slug's card out of blog.html. Shared with the GitHub path. */
export function removeCard(html: string, slug: string) {
  const href = `posts/${slug}.html`;
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const card = new RegExp(
    `\\n?[ \\t]*(?:<article class="[^"]*post-card[^"]*"[^>]*data-url="${escapedHref}"[\\s\\S]*?<\\/article>|<a class="[^"]*post-card[^"]*"[^>]*href="${escapedHref}"[\\s\\S]*?<\\/a>)`
  );
  return html.replace(card, "");
}

/** Removes a published post's file and its card, used when unpublishing. */
export async function unpublishPost(slug: string) {
  const root = siteRoot();
  const blogPath = path.join(root, "blog.html");
  const blogHtml = await fs.readFile(blogPath, "utf8");
  await fs.writeFile(blogPath, removeCard(blogHtml, slug), "utf8");
  await fs.rm(path.join(root, "posts", `${slug}.html`), { force: true });
}
