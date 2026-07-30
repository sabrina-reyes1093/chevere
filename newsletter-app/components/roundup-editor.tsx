"use client";

import { useState } from "react";

import { ImageField } from "@/components/image-field";
import type { HomepageRoundup, HomepageRoundupCard } from "@/lib/homepage-roundup";

export function RoundupEditor({ initialRoundup }: { initialRoundup: HomepageRoundup }) {
  const [roundup, setRoundup] = useState(initialRoundup);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function updateCard(index: number, field: keyof HomepageRoundupCard, value: string) {
    setRoundup((current) => {
      const cards = current.cards.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: value } : card);
      return { ...current, cards };
    });
    setStatus("");
  }

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/homepage-roundup", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(roundup),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save the Weekly Roundup.");
      setStatus(roundup.enabled ? "The Weekly Roundup was saved and is now live on the homepage." : "The Weekly Roundup was saved as a draft (hidden from the homepage).");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save the Weekly Roundup.");
    } finally {
      setSaving(false);
    }
  }

  const isError = /unable|needs|check/i.test(status);

  return (
    <div className="featured-admin-layout">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Homepage</p>
            <h2>Weekly Roundup</h2>
          </div>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={roundup.enabled}
              onChange={(event) => { setRoundup((current) => ({ ...current, enabled: event.target.checked })); setStatus(""); }}
            />
            Show on homepage
          </label>
        </div>
        <p className="field-help">
          These three cards power the &ldquo;This Week at Ch&eacute;vere&rdquo; roundup on the homepage. When enabled, they replace the
          newsletter-issue roundup. Each card needs an image, alt text, title, and destination URL.
        </p>

        {roundup.cards.map((card, index) => (
          <div className="roundup-admin-card panel" key={index}>
            <div className="roundup-admin-heading">
              <strong>Card {index + 1}</strong>
            </div>
            <div className="stack">
              <ImageField label="Image" value={card.image_url} onChange={(url) => updateCard(index, "image_url", url)} disabled={saving} />
              <label>Image alt text<input value={card.image_alt} onChange={(event) => updateCard(index, "image_alt", event.target.value)} /></label>
              <div className="two-col">
                <label>Category <span className="optional">(optional)</span><input value={card.category} onChange={(event) => updateCard(index, "category", event.target.value)} /></label>
                <label>Button label<input value={card.cta_label} onChange={(event) => updateCard(index, "cta_label", event.target.value)} placeholder="Read More" /></label>
              </div>
              <label>Title<input value={card.title} onChange={(event) => updateCard(index, "title", event.target.value)} /></label>
              <label>Description <span className="optional">(optional)</span><textarea rows={2} value={card.text} onChange={(event) => updateCard(index, "text", event.target.value)} /></label>
              <div className="two-col">
                <label>Destination URL<input value={card.url} onChange={(event) => updateCard(index, "url", event.target.value)} placeholder="/posts/example.html or https://…" /></label>
                <label>Link type
                  <select value={card.link_type} onChange={(event) => updateCard(index, "link_type", event.target.value)}>
                    <option value="internal">Internal (this site)</option>
                    <option value="external">External (opens new tab)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        ))}

        <div className="editor-actions">
          <button type="button" className="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Weekly Roundup"}</button>
          {status ? <p role="status" className={isError ? "error-text" : "success-text"}>{status}</p> : null}
        </div>
      </section>

      <aside className="featured-admin-preview" aria-labelledby="roundup-preview-title">
        <p className="eyebrow">Homepage preview</p>
        <h2 id="roundup-preview-title">This Week at Ch&eacute;vere</h2>
        <div className="featured-admin-preview-grid">
          {roundup.cards.map((card, index) => (
            <article key={index}>
              {card.image_url
                ? <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.image_url} alt={card.image_alt} />
                  </>
                : <div className="roundup-preview-placeholder">Card {index + 1}</div>}
              <span>{card.category || "Category"}</span>
              <h3>{card.title || `Card ${index + 1}`}</h3>
              {card.text ? <p>{card.text}</p> : null}
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
