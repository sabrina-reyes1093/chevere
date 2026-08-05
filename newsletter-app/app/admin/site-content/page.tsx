import { AdminShell } from "@/components/admin-shell";
import { SiteContentEditor } from "@/components/site-content-editor";
import { requireAdminPage } from "@/lib/auth";
import { loadPublishedArticles } from "@/lib/featured-reads";
import { loadSiteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function SiteContentPage() {
  await requireAdminPage();
  const content = await loadSiteContent();
  let articles: Awaited<ReturnType<typeof loadPublishedArticles>> = [];
  let articleLoadError = "";
  try {
    articles = await loadPublishedArticles();
  } catch {
    articleLoadError = "Published stories are temporarily unavailable. Seasonal copy remains visible, but story selection cannot be saved until the list reloads.";
  }

  return (
    <AdminShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Homepage</p>
          <h1>Site content</h1>
          <p>Change the current season, its homepage message, and the published stories included in the seasonal guide.</p>
        </div>
      </div>
      <SiteContentEditor initialContent={content} articles={articles} articleLoadError={articleLoadError} />
    </AdminShell>
  );
}
