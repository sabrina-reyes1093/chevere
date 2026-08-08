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
