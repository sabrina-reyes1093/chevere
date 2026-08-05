"use client";

import { useMemo, useState } from "react";

import type { FeaturedReadArticle } from "@/lib/featured-reads";
import type { SiteContent } from "@/lib/site-content";

type Props = {
  initialContent: SiteContent;
  articles: FeaturedReadArticle[];
  articleLoadError?: string;
};

type EditorStatus = { message: string; tone: "success" | "error" | "info" } | null;

const seasons = ["Spring", "Summer", "Fall", "Winter"] as const;

export function SiteContentEditor({ initialContent, articles, articleLoadError = "" }: Props) {
  const [content, setContent] = useState(initialContent);
  const [yearDraft, setYearDraft] = useState(String(initialContent.seasonal_banner.year));
  const [status, setStatus] = useState<EditorStatus>(null);
  const [saving, setSaving] = useState(false);

  const postSlugs = content.seasonal_banner.post_slugs;
  const selectedArticles = useMemo(
    () => postSlugs
      .map((slug) => articles.find((article) => article.slug === slug))
      .filter((article): article is FeaturedReadArticle => Boolean(article)),
    [articles, postSlugs],
  );
  const selectionIsValid = postSlugs.length > 0
    && postSlugs.length <= 12
    && selectedArticles.length === postSlugs.length
    && new Set(postSlugs).size === postSlugs.length;
  const yearIsValid = /^\d{4}$/.test(yearDraft)
    && Number(yearDraft) >= 2020
    && Number(yearDraft) <= 2100;

  function updateBanner(
    field: keyof SiteContent["seasonal_banner"],
    value: string | number | boolean | string[],
  ) {
    setContent((current) => ({
      ...current,
      seasonal_banner: { ...current.seasonal_banner, [field]: value },
    }));
    setStatus(null);
  }

  function changeSeason(season: SiteContent["seasonal_banner"]["season"]) {
    const year = yearIsValid ? Number(yearDraft) : content.seasonal_banner.year;
    setContent((current) => ({
      ...current,
      seasonal_banner: {
        ...current.seasonal_banner,
        season,
        year,
        label: `${season.toUpperCase()} ${year}`,
        headline: `The ${season} Guide`,
      },
    }));
    setStatus(null);
  }

  function commitYear() {
    if (!yearIsValid) return;
    const year = Number(yearDraft);
    setContent((current) => ({
      ...current,
      seasonal_banner: {
        ...current.seasonal_banner,
        year,
        label: `${current.seasonal_banner.season.toUpperCase()} ${year}`,
      },
    }));
    setStatus(null);
  }

  function selectArticle(index: number, slug: string) {
    const next = [...postSlugs];
    next[index] = slug;
    updateBanner("post_slugs", next);
  }

  function moveArticle(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= postSlugs.length) return;
    const next = [...postSlugs];
    [next[index], next[destination]] = [next[destination], next[index]];
    setContent((current) => ({
      ...current,
      seasonal_banner: { ...current.seasonal_banner, post_slugs: next },
    }));
    const title = articles.find((article) => article.slug === postSlugs[index])?.title || `Story ${index + 1}`;
    setStatus({ message: `${title} moved to position ${destination + 1}.`, tone: "info" });
  }

  function removeArticle(index: number) {
    if (postSlugs.length === 1) {
      setStatus({ message: "Keep at least one published story in the seasonal guide.", tone: "error" });
      return;
    }
    updateBanner("post_slugs", postSlugs.filter((_, selectedIndex) => selectedIndex !== index));
  }

  function addArticle() {
    const nextArticle = articles.find((article) => !postSlugs.includes(article.slug));
    if (postSlugs.length >= 12) {
      setStatus({ message: "The seasonal guide can include up to 12 stories.", tone: "error" });
      return;
    }
    if (!nextArticle) {
      setStatus({ message: "Every published story is already in this guide.", tone: "error" });
      return;
    }
    updateBanner("post_slugs", [...postSlugs, nextArticle.slug]);
  }

  async function save() {
    if (!yearIsValid) {
      setStatus({ message: "Enter a year from 2020 through 2100.", tone: "error" });
      return;
    }
    if (!selectionIsValid) {
      setStatus({ message: "Choose at least one published story, without duplicates.", tone: "error" });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/site-content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...content,
          seasonal_banner: { ...content.seasonal_banner, year: Number(yearDraft) },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save seasonal content.");
      setStatus({ message: `${content.seasonal_banner.headline} was saved and published.`, tone: "success" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Unable to save seasonal content.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="site-content-editor">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Homepage</p>
            <h2>Seasonal guide settings</h2>
            <p className="panel-intro">Choose the active season first. You can still personalize the label, headline, and description below.</p>
          </div>
          <label className="toggle-label">
            <input type="checkbox" checked={content.seasonal_banner.enabled} onChange={(event) => updateBanner("enabled", event.target.checked)} />
            Show seasonal guide
          </label>
        </div>
        <div className="editor-grid">
          <label>
            Current season
            <select value={content.seasonal_banner.season} onChange={(event) => changeSeason(event.target.value as SiteContent["seasonal_banner"]["season"])}>
              {seasons.map((season) => <option key={season} value={season}>{season}</option>)}
            </select>
          </label>
          <label>
            Year
            <input
              type="number"
              min="2020"
              max="2100"
              value={yearDraft}
              aria-invalid={!yearIsValid}
              aria-describedby={!yearIsValid ? "seasonal-year-error" : undefined}
              onChange={(event) => { setYearDraft(event.target.value); setStatus(null); }}
              onBlur={commitYear}
            />
            {!yearIsValid ? <span id="seasonal-year-error" className="field-error error-text">Enter a year from 2020 through 2100.</span> : null}
          </label>
          <label>Season label<input value={content.seasonal_banner.label} onChange={(event) => updateBanner("label", event.target.value)} /></label>
          <label>Headline<input value={content.seasonal_banner.headline} onChange={(event) => updateBanner("headline", event.target.value)} /></label>
          <label className="span-2">Description<textarea rows={3} value={content.seasonal_banner.description} onChange={(event) => updateBanner("description", event.target.value)} /></label>
          <label>Destination URL<input value={content.seasonal_banner.href} onChange={(event) => updateBanner("href", event.target.value)} /></label>
          <label>CTA label<input value={content.seasonal_banner.cta_label} onChange={(event) => updateBanner("cta_label", event.target.value)} /></label>
          <label>Publish date<input type="date" value={content.seasonal_banner.publish_date} onChange={(event) => updateBanner("publish_date", event.target.value)} /></label>
          <label>Expiration date <span className="optional">(optional)</span><input type="date" value={content.seasonal_banner.expiration_date} onChange={(event) => updateBanner("expiration_date", event.target.value)} /></label>
        </div>
      </section>

      <section className="admin-panel" aria-labelledby="seasonal-stories-title">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Seasonal curation</p>
            <h2 id="seasonal-stories-title">Stories in this guide</h2>
            <p className="panel-intro">Pick published posts and arrange them in the order readers should see them. The public guide updates when you save.</p>
          </div>
          <span className="selection-count">{postSlugs.length} of 12</span>
        </div>

        <div className="seasonal-story-slots">
          {articleLoadError ? <p className="message error" role="alert">{articleLoadError}</p> : null}
          {postSlugs.map((slug, index) => (
            <div className="seasonal-story-slot" key={slug}>
              <div className="seasonal-story-order">
                <strong>Story {index + 1}</strong>
                <div>
                  <button type="button" className="text-button" onClick={() => moveArticle(index, -1)} disabled={index === 0} aria-label={`Move ${articles.find((article) => article.slug === slug)?.title || `seasonal story ${index + 1}`} earlier`}>&uarr; Earlier</button>
                  <button type="button" className="text-button" onClick={() => moveArticle(index, 1)} disabled={index === postSlugs.length - 1} aria-label={`Move ${articles.find((article) => article.slug === slug)?.title || `seasonal story ${index + 1}`} later`}>Later &darr;</button>
                  <button type="button" className="text-button danger-text" onClick={() => removeArticle(index)} aria-label={`Remove ${articles.find((article) => article.slug === slug)?.title || `seasonal story ${index + 1}`}`}>Remove</button>
                </div>
              </div>
              <label>
                Published article
                <select value={slug} onChange={(event) => selectArticle(index, event.target.value)}>
                  {articles.map((article) => (
                    <option
                      key={article.slug}
                      value={article.slug}
                      disabled={postSlugs.some((selectedSlug, selectedIndex) => selectedIndex !== index && selectedSlug === article.slug)}
                    >
                      {article.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>

        <button type="button" className="secondary add-seasonal-story" onClick={addArticle} disabled={postSlugs.length >= 12}>+ Add another story</button>

        <div className="seasonal-guide-preview" aria-labelledby="seasonal-preview-title">
          <div>
            <p className="eyebrow">Guide preview</p>
            <h3 id="seasonal-preview-title">{content.seasonal_banner.headline}</h3>
          </div>
          <div className="seasonal-guide-preview-grid">
            {selectedArticles.map((article) => (
              <article key={article.slug}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.image_url} alt={article.image_alt} />
                <span>{article.category}</span>
                <h4>{article.title}</h4>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="editor-actions seasonal-save-actions">
        <button type="button" className="primary" onClick={save} disabled={saving || !selectionIsValid || !yearIsValid || Boolean(articleLoadError)}>{saving ? "Saving..." : "Save & Publish Seasonal Guide"}</button>
        {status ? <p role="status" className={status.tone === "error" ? "error-text" : status.tone === "success" ? "success-text" : undefined}>{status.message}</p> : null}
      </div>
    </div>
  );
}
