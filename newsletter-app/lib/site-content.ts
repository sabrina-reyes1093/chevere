import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config";
import { commitFiles, readFileFromRepo } from "./publish-github";
import { siteRoot } from "./publish-post";
import { resolveSiteContentSource } from "./site-content-admin-loader";
import { siteContentSchema, type SiteContent } from "./site-content-schema";

export { siteContentSchema };
export type { SiteContent };

const localPath = path.join(siteRoot(), "site-content.json");
const localFallbackPath = path.join(process.cwd(), "site-content-fallback.json");
const hostedLoadWarning = "Site Content could not reach its repository source. The current deployment snapshot is shown below, but saving is disabled until the production GitHub connection is restored.";

export async function loadSiteContent(): Promise<SiteContent> {
  const result = await resolveSiteContentSource({
    githubConfigured: config.githubConfigured,
    bundledSource: process.env.SITE_CONTENT_FALLBACK_JSON || "",
    loadRemote: () => readFileFromRepo("site-content.json"),
    loadLocal: () => fs.readFile(localPath, "utf8"),
    validateSource: (source) => { siteContentSchema.parse(JSON.parse(source)); },
  });
  const content = siteContentSchema.parse(JSON.parse(result.source));

  if (result.usedFallback) {
    console.error("Site Content could not load its repository source. Showing the bundled deployment snapshot in read-only mode.", result.error);
    return Object.assign(content, { _adminLoadWarning: hostedLoadWarning });
  }

  return content;
}

export async function saveSiteContent(content: SiteContent) {
  const parsed = siteContentSchema.parse(content);
  const source = `${JSON.stringify(parsed, null, 2)}\n`;
  if (config.githubToken && config.githubRepo) {
    await commitFiles(
      [
        { path: "site-content.json", content: source },
        { path: "newsletter-app/site-content-fallback.json", content: source },
      ],
      "content: update homepage editorial modules",
    );
  } else {
    await Promise.all([
      fs.writeFile(localPath, source, "utf8"),
      fs.writeFile(localFallbackPath, source, "utf8"),
    ]);
  }
}
