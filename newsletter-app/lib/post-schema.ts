import { z } from "zod";

/** Public taxonomy shared by the navigation, blog filters, and admin editor. */
export const CATEGORY_GROUPS = [
  {
    slug: "culture",
    label: "Culture",
    categories: [
      { slug: "art", label: "Art" },
      { slug: "books", label: "Books" },
      { slug: "film-tv", label: "Film & TV" },
      { slug: "music", label: "Music" },
      { slug: "sports", label: "Sports" },
      { slug: "pop-culture", label: "Pop Culture" },
    ],
  },
  {
    slug: "style",
    label: "Style",
    categories: [
      { slug: "fashion", label: "Fashion" },
      { slug: "beauty", label: "Beauty" },
      { slug: "interiors", label: "Interiors" },
      { slug: "design", label: "Design" },
    ],
  },
  {
    slug: "life",
    label: "Life",
    categories: [
      { slug: "food", label: "Food" },
      { slug: "travel", label: "Travel" },
      { slug: "life-wellness", label: "Life & Wellness" },
    ],
  },
  {
    slug: "guides",
    label: "Guides",
    categories: [
      { slug: "reading-lists", label: "Reading Lists" },
      { slug: "city-guides", label: "City Guides" },
      { slug: "seasonal-recommendations", label: "Seasonal Recommendations" },
      { slug: "restaurant-roundups", label: "Restaurant Roundups" },
      { slug: "gift-guides", label: "Gift Guides" },
    ],
  },
] as const;

export const CATEGORIES = CATEGORY_GROUPS.flatMap((group) =>
  group.categories.map((category) => ({ ...category, section: group.slug, sectionLabel: group.label })),
);

export const STANDALONE_POST_CATEGORY = { slug: "introduction", label: "Standalone introduction" } as const;

export const SERIES_OPTIONS = [
  { slug: "", label: "None" },
  { slug: "weekly-roundup", label: "Weekly Roundup" },
  { slug: "the-month-ahead", label: "The Month Ahead" },
  { slug: "seasonal-guides", label: "Seasonal Guides" },
] as const;

export const MONTH_OPTIONS = [
  { value: "01", label: "January" }, { value: "02", label: "February" },
  { value: "03", label: "March" }, { value: "04", label: "April" },
  { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" },
  { value: "09", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
] as const;

export const SEASON_OPTIONS = ["Spring", "Summer", "Fall", "Winter", "Holiday"] as const;

export type SeriesSlug = (typeof SERIES_OPTIONS)[number]["slug"];

export type EditorialCategorySlug = (typeof CATEGORIES)[number]["slug"];
export type CategorySlug = EditorialCategorySlug | typeof STANDALONE_POST_CATEGORY.slug;

const LEGACY_CATEGORY_ALIASES: Record<string, CategorySlug> = {
  "tv-film": "film-tv",
  "food-drink": "food",
  wellness: "life-wellness",
  culture: "pop-culture",
};

const EXISTING_POST_CATEGORY_OVERRIDES: Record<string, CategorySlug[]> = {
  "best-chicago-patios-2026": ["restaurant-roundups"],
  "about-chevere": ["introduction"],
  "maybe-women-should-be-more-difficult": ["life-wellness"],
  "my-current-obsessions": ["pop-culture"],
  "dua-lipa-vacation": ["travel"],
};

// The database keeps this as one text field for backward compatibility. Multiple
// categories are stored as a comma-separated list, so no duplicate post row or
// article file is needed.
export function splitCategoryValue(value: string) {
  return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
}

function isRecognizedCategory(slug: string) {
  return slug === STANDALONE_POST_CATEGORY.slug || Boolean(LEGACY_CATEGORY_ALIASES[slug]) || CATEGORIES.some((item) => item.slug === slug);
}

export const postSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(200).refine(
    (value) => splitCategoryValue(value).every(isRecognizedCategory),
    "Choose at least one valid category.",
  ),
  dek: z.string().trim().max(400),
  body: z.string().max(60000),
  cover_image_url: z.string().trim().url().or(z.literal("")),
  hero_image_url: z.string().trim().url().or(z.literal("")),
  signoff: z.string().trim().max(300),
  published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  series: z.enum(["", "weekly-roundup", "the-month-ahead", "seasonal-guides"]).default(""),
  series_month: z.enum(["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]).default(""),
  series_year: z.string().trim().regex(/^(?:|20\d{2})$/, "Use a four-digit year.").default(""),
  series_season: z.enum(["", ...SEASON_OPTIONS]).default(""),
  series_issue_number: z.string().trim().max(8).regex(/^(?:|\d{1,8})$/, "Use digits only.").default(""),
  series_edition_date: z.string().regex(/^(?:|\d{4}-\d{2}-\d{2})$/, "Use YYYY-MM-DD.").default(""),
  featured_on_homepage: z.boolean().default(false),
  show_in_latest: z.boolean().default(true),
  show_in_series_section: z.boolean().default(true),
  author: z.string().trim().max(120).default("Chévere"),
}).superRefine((value, context) => {
  if (value.series === "the-month-ahead") {
    if (!value.series_month) context.addIssue({ code: "custom", path: ["series_month"], message: "Choose a month." });
    if (!value.series_year) context.addIssue({ code: "custom", path: ["series_year"], message: "Add the edition year." });
  }
  if (value.series === "seasonal-guides") {
    if (!value.series_season) context.addIssue({ code: "custom", path: ["series_season"], message: "Choose a season." });
    if (!value.series_year) context.addIssue({ code: "custom", path: ["series_year"], message: "Add the edition year." });
  }
  if (value.series === "weekly-roundup") {
    if (!value.series_issue_number) context.addIssue({ code: "custom", path: ["series_issue_number"], message: "Add the issue number." });
    if (!value.series_edition_date) context.addIssue({ code: "custom", path: ["series_edition_date"], message: "Choose the week or edition date." });
  }
});

export type PostInput = z.infer<typeof postSchema>;

export type Post = PostInput & {
  id: string;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export function categoryLabel(slug: string) {
  const normalized = normalizeCategory(slug);
  if (normalized === STANDALONE_POST_CATEGORY.slug) return "Introduction";
  return CATEGORIES.find((item) => item.slug === normalized)?.label || "Pop Culture";
}

export function categoryLabels(value: string, postSlug?: string) {
  return normalizePostCategories(value, postSlug).map(categoryLabel).join(" · ");
}

export function normalizeCategory(slug: string): CategorySlug {
  if (slug === STANDALONE_POST_CATEGORY.slug) return slug;
  const normalized = LEGACY_CATEGORY_ALIASES[slug] || slug;
  return (CATEGORIES.some((item) => item.slug === normalized) ? normalized : "pop-culture") as CategorySlug;
}

export function normalizePostCategory(category: string, postSlug?: string): CategorySlug {
  return normalizePostCategories(category, postSlug)[0];
}

export function normalizePostCategories(category: string, postSlug?: string): CategorySlug[] {
  const override = postSlug && EXISTING_POST_CATEGORY_OVERRIDES[postSlug];
  const values = override || splitCategoryValue(category).map(normalizeCategory);
  return Array.from(new Set<CategorySlug>(values.length ? values : ["pop-culture"]));
}

export function serializeCategories(categories: readonly CategorySlug[]) {
  return Array.from(new Set(categories)).join(",");
}

export function categorySection(slug: string) {
  const normalized = normalizeCategory(slug);
  if (normalized === STANDALONE_POST_CATEGORY.slug) return "";
  return CATEGORIES.find((item) => item.slug === normalized)?.section || "culture";
}

export function categorySections(value: string, postSlug?: string) {
  return Array.from(new Set(normalizePostCategories(value, postSlug).map(categorySection).filter(Boolean)));
}

export function seriesLabel(series: SeriesSlug | string) {
  return SERIES_OPTIONS.find((item) => item.slug === series)?.label || "";
}

export function monthLabel(month: string) {
  return MONTH_OPTIONS.find((item) => item.value === month)?.label || "";
}

export function seriesEditionLabel(post: Pick<PostInput, "series" | "series_month" | "series_year" | "series_season" | "series_issue_number" | "series_edition_date">) {
  if (post.series === "the-month-ahead") return [seriesLabel(post.series), monthLabel(post.series_month), post.series_year].filter(Boolean).join(" · ");
  if (post.series === "seasonal-guides") return [seriesLabel(post.series), post.series_season, post.series_year].filter(Boolean).join(" · ");
  if (post.series === "weekly-roundup") {
    const issue = post.series_issue_number ? `No. ${post.series_issue_number.padStart(2, "0")}` : "";
    const edition = post.series_edition_date ? displayDate(post.series_edition_date) : "";
    return [seriesLabel(post.series), issue, edition].filter(Boolean).join(" · ");
  }
  return "";
}

/** Turn a title into a URL-safe slug, matching the existing files in posts/. */
export function slugify(title: string) {
  return title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

/** "2026-07-18" -> "Jul 18, 2026", the format used on every card and post. */
export function displayDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1]} ${day}, ${year}`;
}

/** Blocks a post from publishing until it would actually render correctly. */
export function validateForPublish(value: PostInput) {
  if (!value.title.trim()) return "Give the post a title.";
  if (!value.dek.trim()) return "Add a short description - it appears on the blog card.";
  if (!value.body.trim()) return "The post has no body yet.";
  if (!value.cover_image_url) return "Add a cover image - the blog card needs one.";
  return null;
}
