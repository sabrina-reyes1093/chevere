import { categoryLabels, displayDate, type PostInput } from "@/lib/post-schema";

/** Cache-busting suffixes used by the published pages. Keep in step with the
 *  values in blog.html and index.html when those are bumped. */
export const ASSET_VERSIONS = { styles: "20260731-2", site: "20260731-2" };

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] || char));
}

/** Inline markdown: images, links, bold, italic. Input is escaped first, so
 *  authored HTML is shown as text rather than injected into the page. */
function inline(value: string) {
  return escape(value)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => `<img class="post-inline-img" src="${url}" alt="${alt}" />`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => `<a href="${url}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

/** Block markdown: blank-line separated paragraphs, ## and ### headings, and
 *  standalone images. Deliberately small - it only needs to cover what the
 *  existing posts actually use. */
export function renderBody(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${inline(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.split("\n").every((line) => line.trim().startsWith(">"))) {
        const lines = block.split("\n").map((line) => line.trim().replace(/^>\s?/, "")).filter(Boolean);
        const last = lines.at(-1) || "";
        const hasAttribution = /^(?:—|-)\s+/.test(last);
        const attribution = hasAttribution ? last.replace(/^(?:—|-)\s+/, "") : "";
        const quote = hasAttribution ? lines.slice(0, -1).join(" ") : lines.join(" ");
        return `<figure class="editorial-quote"><blockquote>${inline(quote)}</blockquote>${attribution ? `<figcaption>${inline(attribution)}</figcaption>` : ""}</figure>`;
      }
      const standaloneImage = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (standaloneImage) {
        return `<img class="post-inline-img" src="${escape(standaloneImage[2])}" alt="${escape(standaloneImage[1])}" />`;
      }
      return `<p>${inline(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n      ");
}

const HEADER = `  <header class="site-header">
    <a class="header-logo" href="../index.html" aria-label="chévere home">
      <img src="../assets/logo.png" alt="chévere" />
    </a>
    <div class="header-actions">
      <button id="mobile-menu-toggle" class="mobile-menu-toggle" type="button" aria-label="Open menu" aria-controls="site-navigation" aria-expanded="false"><i data-lucide="menu" stroke-width="1.8" aria-hidden="true"></i></button>
      <button id="search-toggle" aria-label="Search" title="Search"><i data-lucide="search" stroke-width="1.8" aria-hidden="true"></i></button>
      <a class="join-list-button" href="../index.html#newsletter">JOIN THE LIST</a>
      <a href="https://www.instagram.com/itschevere/" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
      </a>
      <a href="https://www.tiktok.com/@itschevere" target="_blank" rel="noopener" aria-label="TikTok" title="TikTok">
        <svg class="tiktok-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="19" height="19"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.3 0 .59.05.87.13v-3.5a6.37 6.37 0 0 0-.87-.06A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.46a8.23 8.23 0 0 0 4.77 1.48v-3.4a4.86 4.86 0 0 1-1.01.15z"/></svg>
      </a>
    </div>
    <div id="search-panel" class="search-panel" role="dialog" aria-label="Search posts">
      <div class="search-bar-wrap">
        <i data-lucide="search" class="search-bar-icon" stroke-width="2" aria-hidden="true"></i>
        <input id="search-input" type="text" placeholder="Search posts..." autocomplete="off" />
        <button id="search-submit" class="search-action-btn" aria-label="Search" type="button">
          <i data-lucide="arrow-right" stroke-width="2.5" aria-hidden="true"></i>
        </button>
        <button id="search-close" class="search-close-btn" aria-label="Close search" type="button">
          <i data-lucide="x" stroke-width="2.5" aria-hidden="true"></i>
        </button>
      </div>
      <div id="search-results" class="search-results"></div>
    </div>
  </header>

  <nav class="site-nav" id="site-navigation" aria-label="Primary navigation">
    <a href="../index.html">HOME</a>
    <div class="nav-item has-dropdown">
      <a href="../blog.html?cat=culture">CULTURE<i data-lucide="chevron-down" class="chev" stroke-width="2" aria-hidden="true"></i></a>
      <div class="dropdown">
        <a href="../blog.html?cat=books">Books</a>
        <a href="../blog.html?cat=film-tv">Film &amp; TV</a>
        <a href="../blog.html?cat=music">Music</a>
        <a href="../blog.html?cat=sports">Sports</a>
        <a href="../blog.html?cat=pop-culture">Pop Culture</a>
      </div>
    </div>
    <div class="nav-item has-dropdown">
      <a href="../blog.html?cat=style">STYLE<i data-lucide="chevron-down" class="chev" stroke-width="2" aria-hidden="true"></i></a>
      <div class="dropdown">
        <a href="../blog.html?cat=fashion">Fashion</a>
        <a href="../blog.html?cat=beauty">Beauty</a>
        <a href="../blog.html?cat=interiors">Interiors</a>
        <a href="../blog.html?cat=design">Design</a>
      </div>
    </div>
    <div class="nav-item has-dropdown">
      <a href="../blog.html?cat=life">LIFE<i data-lucide="chevron-down" class="chev" stroke-width="2" aria-hidden="true"></i></a>
      <div class="dropdown">
        <a href="../blog.html?cat=food">Food</a>
        <a href="../blog.html?cat=travel">Travel</a>
        <a href="../blog.html?cat=life-wellness">Life &amp; Wellness</a>
      </div>
    </div>
    <div class="nav-item has-dropdown">
      <a href="../blog.html?cat=guides">GUIDES<i data-lucide="chevron-down" class="chev" stroke-width="2" aria-hidden="true"></i></a>
      <div class="dropdown">
        <a href="../reading-lists.html">Reading Lists</a>
        <a href="../blog.html?cat=city-guides">City Guides</a>
        <a href="../blog.html?cat=seasonal-recommendations">Seasonal Recommendations</a>
        <a href="../blog.html?cat=restaurant-roundups">Restaurant Roundups</a>
        <a href="../blog.html?cat=gift-guides">Gift Guides</a>
      </div>
    </div>
    <a href="../about.html">ABOUT</a>
  </nav>`;

const POST_STYLES = `    .post-body { font-size: 17px; line-height: 1.8; color: var(--text); }
    .post-body p { margin-bottom: 16px; }
    .post-body h2 { font-family: var(--serif); font-size: 24px; color: var(--ink); margin: 32px 0 10px; }
    .post-body h3 { font-family: var(--serif); font-size: 20px; color: var(--ink); margin: 26px 0 8px; }
    .post-body strong { display: block; font-family: var(--serif); font-weight: 700; font-size: 20px; color: var(--ink); margin-top: 32px; margin-bottom: 8px; }
    .post-body em { font-style: italic; }
    .post-hero { width: 100%; height: auto; border-radius: 24px; margin-bottom: 28px; display: block; }
    .post-inline-img { width: 100%; height: auto; border-radius: 20px; margin: 22px 0; display: block; }
    .post-signoff { margin-top: 48px; font-size: 17px; color: var(--gray-soft); }
    .back-link { display: inline-block; margin-bottom: 24px; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--brown); transition: opacity .15s ease; }
    .back-link:hover { opacity: 0.7; }`;

/** Produces a complete post page matching the hand-written files in posts/. */
export function renderPostPage(post: PostInput) {
  const hero = post.hero_image_url
    ? `\n      <img class="post-hero" src="${escape(post.hero_image_url)}" alt="${escape(post.title)}" />`
    : "";
  const signoff = post.signoff.trim()
    ? `\n      <p class="post-signoff">${inline(post.signoff)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escape(post.title)} — chévere</title>
  <meta name="description" content="${escape(post.dek)}" />
  <link rel="icon" type="image/png" href="../assets/icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600;1,700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../styles.css?v=${ASSET_VERSIONS.styles}" />
  <style>
${POST_STYLES}
  </style>
</head>
<body>

${HEADER}

  <main class="page-main">
    <a class="back-link" href="../blog.html">&larr; Back to Blog</a>
    <span class="kicker" style="display:block;margin-bottom:8px">${escape(categoryLabels(post.category, post.slug))}</span>
    <h1 class="page-title">${escape(post.title)}</h1>
    <p class="page-tagline" style="font-size:15px;color:#8e8c88;margin-top:-4px;margin-bottom:28px">${escape(displayDate(post.published_on))}</p>
    <div class="post-body">${hero}
      ${renderBody(post.body)}${signoff}
    </div>
  </main>

  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="../site.js?v=${ASSET_VERSIONS.site}"></script>
</body>
</html>
`;
}
