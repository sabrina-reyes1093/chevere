"use client";

import { useMemo, useState } from "react";

import type { FeaturedRead, FeaturedReadArticle } from "@/lib/featured-reads";

type Props = {
  articles: FeaturedReadArticle[];
  initialItems: FeaturedRead[];
};

export function FeaturedReadsEditor({ articles, initialItems }: Props) {
  const [postIds, setPostIds] = useState(() => initialItems
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((item) => item.slug));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => postIds.map((id) => articles.find((article) => article.slug === id)).filter((article): article is FeaturedReadArticle => Boolean(article)),
    [articles, postIds],
  );
  const isComplete = postIds.length === 3 && selected.length === 3 && new Set(postIds).size === 3;

  function selectArticle(index: number, postId: string) {
    setPostIds((current) => {
      const next = [...current];
      while (next.length < 3) next.push("");
      next[index] = postId;
      return next.slice(0, 3);
    });
    setStatus("");
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination > 2) return;
    setPostIds((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
    setStatus("");
  }

  function orderByNewest() {
    const newest = [...articles]
      .sort((a, b) => new Date(b.published_on).getTime() - new Date(a.published_on).getTime())
      .slice(0, 3)
      .map((article) => article.slug);
    setPostIds(newest);
    setStatus("Filled with the three newest published posts. Click Publish Featured Reads to save.");
  }

  async function publish() {
    if (!isComplete) {
      setStatus("Select exactly three different published articles.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/featured-reads", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_ids: postIds }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to publish Featured Reads.");
      setStatus("Featured Reads is published. The homepage will update shortly.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to publish Featured Reads.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="featured-admin-layout">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Homepage</p>
            <h2>Featured Reads</h2>
          </div>
          <p>Choose three stories manually, or use <strong>Order by newest published</strong> to fill them with your three most recent posts. They stay in place until you publish a new selection.</p>
        </div>

        <div className="editor-actions" style={{ marginBottom: 18 }}>
          <button type="button" className="secondary" onClick={orderByNewest}>Order by newest published</button>
        </div>

        <div className="featured-admin-slots">
          {[0, 1, 2].map((index) => (
            <div className="recommendation featured-admin-slot" key={index}>
              <div className="roundup-admin-heading">
                <strong>Featured Story {index + 1}</strong>
                <div className="featured-admin-order">
                  <button type="button" className="text-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move Featured Story ${index + 1} earlier`}>&uarr; Earlier</button>
                  <button type="button" className="text-button" onClick={() => move(index, 1)} disabled={index === 2} aria-label={`Move Featured Story ${index + 1} later`}>Later &darr;</button>
                </div>
              </div>
              <label>
                Published article
                <select value={postIds[index] || ""} onChange={(event) => selectArticle(index, event.target.value)}>
                  <option value="">Select an article...</option>
                  {articles.map((article) => (
                    <option
                      key={article.slug}
                      value={article.slug}
                      disabled={postIds.some((id, selectedIndex) => selectedIndex !== index && id === article.slug)}
                    >
                      {article.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>

        <div className="editor-actions">
          <button type="button" className="primary" onClick={publish} disabled={saving || !isComplete}>{saving ? "Publishing..." : "Publish Featured Reads"}</button>
          {status ? <p role="status" className={/unable|select exactly|must be/i.test(status) ? "error-text" : "success-text"}>{status}</p> : null}
        </div>
      </section>

      <aside className="featured-admin-preview" aria-labelledby="featured-preview-title">
        <p className="eyebrow">Homepage preview</p>
        <h2 id="featured-preview-title">Featured Reads</h2>
        <div className="featured-admin-preview-grid">
          {[0, 1, 2].map((index) => {
            const article = articles.find((item) => item.slug === postIds[index]);
            return (
              <article key={index}>
                {article?.image_url
                  ? <>
                      {/* Admin previews intentionally render the stored URL exactly as the public card will. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={article.image_url} alt={article.image_alt} />
                    </>
                  : <div className="roundup-preview-placeholder">Story {index + 1}</div>}
                <span>{article?.category || "Category"}</span>
                <h3>{article?.title || `Featured Story ${index + 1}`}</h3>
                {article?.excerpt ? <p>{article.excerpt}</p> : null}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
