import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { config } from "./config";
import { commitFiles, readFileFromRepo } from "./publish-github";
import { siteRoot } from "./publish-post";

/** A single homepage Weekly Roundup card. Mirrors the fields the public
 *  homepage renderer (site.js) reads from /api/roundup. */
export const roundupCardSchema = z.object({
  category: z.string().trim().max(60).default(""),
  title: z.string().trim().max(200).default(""),
  text: z.string().trim().max(1000).default(""),
  url: z.string().trim().max(1000).default(""),
  image_url: z.string().trim().max(1000).default(""),
  image_alt: z.string().trim().max(240).default(""),
  link_type: z.enum(["internal", "external"]).default("internal"),
  cta_label: z.string().trim().max(60).default("Read More"),
});

export const homepageRoundupSchema = z.object({
  enabled: z.boolean().default(false),
  cards: z.array(roundupCardSchema).length(3),
});

export type HomepageRoundup = z.infer<typeof homepageRoundupSchema>;
export type HomepageRoundupCard = z.infer<typeof roundupCardSchema>;

const emptyCard = (): HomepageRoundupCard => ({
  category: "", title: "", text: "", url: "", image_url: "", image_alt: "",
  link_type: "internal", cta_label: "Read More",
});

const defaultRoundup = (): HomepageRoundup => ({
  enabled: false,
  cards: [emptyCard(), emptyCard(), emptyCard()],
});

const localPath = path.join(siteRoot(), "homepage-roundup.json");

export async function loadHomepageRoundup(): Promise<HomepageRoundup> {
  let source: string | null;
  try {
    if (config.githubToken && config.githubRepo) {
      source = await readFileFromRepo("homepage-roundup.json");
    } else {
      source = await fs.readFile(localPath, "utf8");
    }
  } catch {
    // A missing or unreadable file means the standalone roundup is simply not
    // configured yet; the homepage falls back to the newsletter issue.
    return defaultRoundup();
  }
  if (source === null) return defaultRoundup();
  try {
    return homepageRoundupSchema.parse(JSON.parse(source));
  } catch {
    return defaultRoundup();
  }
}

export async function saveHomepageRoundup(roundup: HomepageRoundup) {
  const parsed = homepageRoundupSchema.parse(roundup);
  const source = `${JSON.stringify(parsed, null, 2)}\n`;
  if (config.githubToken && config.githubRepo) {
    await commitFiles(
      [{ path: "homepage-roundup.json", content: source }],
      "content: update homepage weekly roundup",
    );
  } else {
    await fs.writeFile(localPath, source, "utf8");
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isInternalUrl(value: string) {
  return /^(\/(?!\/)|\.{1,2}\/)/.test(value);
}

/** True when all three cards are complete enough to publish to the homepage. */
export function isHomepageRoundupReady(roundup: HomepageRoundup): boolean {
  if (roundup.cards.length !== 3) return false;
  const urls = new Set<string>();
  for (const card of roundup.cards) {
    if (!card.image_url || !card.image_alt || !card.title || !card.url) return false;
    if (!isHttpUrl(card.image_url) && !isInternalUrl(card.image_url)) return false;
    if (card.link_type === "external" && !isHttpUrl(card.url)) return false;
    if (card.link_type === "internal" && !isInternalUrl(card.url) && !isHttpUrl(card.url)) return false;
    if (urls.has(card.url)) return false;
    urls.add(card.url);
  }
  return true;
}
