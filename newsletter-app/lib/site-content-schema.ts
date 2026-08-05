import { z } from "zod";

const calendarDateSchema = z.string().refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a real calendar date in YYYY-MM-DD format.");

export const siteContentSchema = z.object({
  seasonal_banner: z.object({
    enabled: z.boolean(),
    season: z.enum(["Spring", "Summer", "Fall", "Winter"]).default("Summer"),
    year: z.number().int().min(2020).max(2100).default(2026),
    label: z.string().max(80),
    headline: z.string().max(160),
    description: z.string().max(320),
    href: z.string().max(500),
    cta_label: z.string().max(80).default("EXPLORE THE GUIDE"),
    publish_date: calendarDateSchema.default(""),
    expiration_date: calendarDateSchema.default(""),
    post_slugs: z.array(
      z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ).min(1).max(12).refine((slugs) => new Set(slugs).size === slugs.length, {
      message: "Choose each seasonal story only once.",
    }).default([
      "chevere-summer-reading-edit",
      "best-chicago-patios-2026",
      "dua-lipa-vacation",
    ]),
  }).superRefine((banner, context) => {
    if (banner.publish_date && banner.expiration_date && banner.expiration_date < banner.publish_date) {
      context.addIssue({
        code: "custom",
        path: ["expiration_date"],
        message: "Expiration date must be on or after the publish date.",
      });
    }
  }),
});

export type SiteContent = z.infer<typeof siteContentSchema>;
