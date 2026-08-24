"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageField } from "@/components/image-field";
import { CATEGORY_GROUPS, MONTH_OPTIONS, normalizePostCategories, SEASON_OPTIONS, serializeCategories, SERIES_OPTIONS, slugify, STANDALONE_POST_CATEGORY, type CategorySlug, type Post, type PostInput, type SeriesSlug } from "@/lib/post-schema";

const today = () => new Date().toISOString().slice(0, 10);

function getSections(body: string) {
  const parts = body.split(/\n\n+/).filter(Boolean);
  return parts.map((p, i) => {
    const label = p.replace(/^##\s*/, "").replace(/[*_[\]()]/g, "").replace(/!\[.*?\]\(.*?\)/g, "").trim().slice(0, 50);
    return { index: i, label: `After paragraph ${i + 1}: ${label}${label.length >= 50 ? "\u2026" : ""}` };
  });
}

function InlineImageUpload({ onInsert, bodyContent, onAddMore }: { onInsert: (markdown: string) => void; bodyContent: string; onAddMore?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sections = getSections(bodyContent);

  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller. Try a smaller photo.");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const imgMarkdown = `\n\n![${alt}](${data.url})\n`;
      if (sectionIndex === 0) {
        onInsert(imgMarkdown + bodyContent);
      } else if (sectionIndex >= sections.length) {
        onInsert(bodyContent + "\n\n" + imgMarkdown);
      } else {
        const parts = bodyContent.split(/\n\n+/).filter(Boolean);
        parts.splice(sectionIndex, 0, `![${alt}](${data.url})`);
        onInsert(parts.join("\n\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  function takeFirstImage(files: FileList | null | undefined) {
    const file = Array.from(files || []).find((item) => item.type.startsWith("image/"));
    if (!file) return false;
    void upload(file);
    return true;
  }

  const idle = !busy;

  return (
    <div
      ref={containerRef}
      className={`image-field${dragging ? " dragging" : ""}`}
      style={{ marginBottom: 12 }}
      onPaste={(event) => { if (idle && takeFirstImage(event.clipboardData.files)) event.preventDefault(); }}
      onDragOver={(event) => { if (idle) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { if (idle) { event.preventDefault(); setDragging(false); takeFirstImage(event.dataTransfer.files); } }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="secondary" onClick={() => picker.current?.click()} disabled={busy} style={{ fontSize: 13, padding: "7px 14px", minHeight: 36 }}>
          {busy ? "Uploading image\u2026" : "Insert image"}
        </button>
        <select value={sectionIndex} onChange={(e) => setSectionIndex(Number(e.target.value))} style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", minHeight: 36, maxWidth: 340 }}>
          <option value={0}>At the very top</option>
          {sections.map((s) => <option key={s.index} value={s.index + 1}>{s.label}</option>)}
          <option value={sections.length + 1}>At the very bottom</option>
        </select>
        <span className="image-field-hint">Choose file, paste, or drag an image</span>
        <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
      {error && <p className="error-text" style={{ margin: "8px 0 0", fontSize: 13 }}>{error}</p>}
      {onAddMore && <button type="button" className="secondary" onClick={onAddMore} style={{ fontSize: 13, padding: "7px 14px", minHeight: 36, marginTop: 8 }}>+ Add more images</button>}
    </div>
  );
}

function EditorialQuoteInsert({ onInsert }: { onInsert: (markdown: string) => void }) {
  const [quote, setQuote] = useState("");
  const [attribution, setAttribution] = useState("");

  function insert() {
    const cleanQuote = quote.trim();
    if (!cleanQuote) return;
    const block = `> ${cleanQuote}${attribution.trim() ? `\n> — ${attribution.trim()}` : ""}`;
    onInsert(block);
    setQuote("");
    setAttribution("");
  }

  return <div className="quote-insert">
    <div>
      <label>Editorial quote<input value={quote} onChange={(event) => setQuote(event.target.value)} placeholder="Culture begins with curiosity." /></label>
      <label>Attribution (optional)<input value={attribution} onChange={(event) => setAttribution(event.target.value)} placeholder="Name or source" /></label>
    </div>
    <button type="button" className="secondary" onClick={insert} disabled={!quote.trim()}>Insert quote block</button>
  </div>;
}

const empty: PostInput = {
  slug: "", title: "", category: "pop-culture", dek: "", body: "",
  cover_image_url: "", hero_image_url: "", signoff: "Until next week — stay *chévere*",
  published_on: today(),
  series: "", series_month: "", series_year: "", series_season: "",
  series_issue_number: "", series_edition_date: "",
  featured_on_homepage: false, show_in_latest: true, show_in_series_section: true,
  author: "Chévere",
};

export function PostEditor({ initial }: { initial?: Post }) {
  const router = useRouter();
  const [post, setPost] = useState<PostInput>(initial
    ? { ...empty, ...initial, category: serializeCategories(normalizePostCategories(initial.category, initial.slug)) }
    : empty);
  const [id, setId] = useState(initial?.id || "");
  const [status, setStatus] = useState(initial?.status || "draft");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [, setDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [imageUploadCount, setImageUploadCount] = useState(1);
  const dirtyRef = useRef(false);
  const idRef = useRef(id);
  const postRef = useRef(post);
  useEffect(() => { idRef.current = id; }, [id]);
  useEffect(() => { postRef.current = post; }, [post]);

  const markDirty = () => { setDirty(true); dirtyRef.current = true; };

  const field = <Key extends keyof PostInput,>(name: Key, value: PostInput[Key]) => { setPost((current) => ({ ...current, [name]: value })); markDirty(); };

  function changeSeries(series: SeriesSlug) {
    setPost((current) => ({
      ...current,
      series,
      series_month: "",
      series_year: "",
      series_season: "",
      series_issue_number: "",
      series_edition_date: "",
    }));
    markDirty();
  }

  function toggleCategory(category: CategorySlug, checked: boolean) {
    setPost((current) => {
      const selected = normalizePostCategories(current.category);
      const next = checked
        ? category === STANDALONE_POST_CATEGORY.slug
          ? [category]
          : [...selected.filter((item) => item !== STANDALONE_POST_CATEGORY.slug), category]
        : selected.filter((item) => item !== category);
      return next.length ? { ...current, category: serializeCategories(next) } : current;
    });
    markDirty();
  }

  function changeTitle(value: string) {
    setPost((current) => ({ ...current, title: value, slug: slugTouched ? current.slug : slugify(value) }));
    markDirty();
  }

  // Auto-save every 30 seconds and on navigate away
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!dirtyRef.current || !idRef.current) return;
      dirtyRef.current = false; setDirty(false);
      try { await request(`/api/admin/posts/${idRef.current}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(postRef.current) }); }
      catch { dirtyRef.current = true; setDirty(true); }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  async function request(url: string, options: RequestInit) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, options);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Request failed.");
      return body;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); throw error; }
    finally { setBusy(false); }
  }

  async function save() {
    const data = await request(id ? `/api/admin/posts/${id}` : "/api/admin/posts", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    setId(data.id); setStatus(data.status); setMessage("Draft saved.");
    setDirty(false); dirtyRef.current = false;
    if (!id) router.replace(`/admin/posts/${data.id}`);
  }

  async function showPreview() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/posts/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(post),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Preview failed.");
      setPreview(await response.text());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed."); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!id) return setMessage("Save the draft before publishing.");
    await save();
    const data = await request(`/api/admin/posts/${id}/publish`, { method: "POST" });
    setStatus("published"); setMessage(data.message);
    router.refresh();
  }

  async function unpublish() {
    if (!id) return;
    const data = await request(`/api/admin/posts/${id}/publish`, { method: "DELETE" });
    setStatus("draft"); setMessage(data.message);
    router.refresh();
  }

  const selectedCategories = normalizePostCategories(post.category);

  return <>
    <div className="page-heading">
      <div>
        <p className="eyebrow">Chévere Weekly</p>
        <h1>{id ? post.title || "Untitled post" : "New blog post"}</h1>
        <p><span className={`status ${status === "published" ? "sent" : status}`}>{status}</span>{post.slug && ` /posts/${post.slug}.html`}</p>
      </div>
      <Link href="/admin/posts" className="secondary link-button">Back to posts</Link>
    </div>
    {message && <p className={`message ${/failed|error|unable|review|before|already/i.test(message) ? "error" : "success"}`}>{message}</p>}

    <div className="editor-layout">
      <form className="editor stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={busy}>
          <legend>Post details</legend>
          <label>Title<input value={post.title} onChange={(e) => changeTitle(e.target.value)} required /></label>
          <label>Web address
            <input value={post.slug} onChange={(e) => { setSlugTouched(true); field("slug", e.target.value); }} required />
            <small className="field-hint">Lowercase words with hyphens. The page will live at /posts/{post.slug || "your-post"}.html</small>
          </label>
          <label>Excerpt<textarea rows={3} value={post.dek} onChange={(e) => field("dek", e.target.value)} />
            <small className="field-hint">Shown on the blog card and used as the page description.</small>
          </label>
          <ImageField label="Cover image" value={post.cover_image_url} onChange={(url) => field("cover_image_url", url)} disabled={busy} />
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Organization</legend>
          <div>
            <p style={{ marginBottom: 8, fontWeight: 600 }}>Category</p>
            <div style={{ display: "grid", gap: 10, padding: 12, border: "1px solid var(--line)", borderRadius: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontWeight: 400 }}>
                <input type="checkbox" checked={selectedCategories.includes(STANDALONE_POST_CATEGORY.slug)} onChange={(e) => toggleCategory(STANDALONE_POST_CATEGORY.slug, e.target.checked)} style={{ width: "auto" }} />
                {STANDALONE_POST_CATEGORY.label}
              </label>
              {CATEGORY_GROUPS.map((group) => <div key={group.slug}>
                <strong style={{ display: "block", marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>{group.label}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                  {group.categories.map((item) => <label key={item.slug} style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontWeight: 400 }}>
                    <input type="checkbox" checked={selectedCategories.includes(item.slug)} onChange={(e) => toggleCategory(item.slug, e.target.checked)} style={{ width: "auto" }} />
                    {item.label}
                  </label>)}
                </div>
              </div>)}
            </div>
            <small className="field-hint">Categories control the normal Culture, Style, Life, and Guides archives.</small>
          </div>
          <label>Series
            <select value={post.series} onChange={(event) => changeSeries(event.target.value as SeriesSlug)}>
              {SERIES_OPTIONS.map((item) => <option key={item.slug || "none"} value={item.slug}>{item.label}</option>)}
            </select>
            <small className="field-hint">Series are independent from categories and organize recurring editorial editions.</small>
          </label>
          {post.series === "the-month-ahead" && <div className="two-col">
            <label>Month<select value={post.series_month} onChange={(event) => field("series_month", event.target.value as PostInput["series_month"])} required>
              <option value="">Choose month</option>
              {MONTH_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select></label>
            <label>Year<input inputMode="numeric" value={post.series_year} onChange={(event) => field("series_year", event.target.value)} placeholder="2026" required /></label>
          </div>}
          {post.series === "seasonal-guides" && <div className="two-col">
            <label>Season<select value={post.series_season} onChange={(event) => field("series_season", event.target.value as PostInput["series_season"])} required>
              <option value="">Choose season</option>
              {SEASON_OPTIONS.map((season) => <option key={season} value={season}>{season}</option>)}
            </select></label>
            <label>Year<input inputMode="numeric" value={post.series_year} onChange={(event) => field("series_year", event.target.value)} placeholder="2026" required /></label>
          </div>}
          {post.series === "weekly-roundup" && <div className="two-col">
            <label>Issue Number<input inputMode="numeric" value={post.series_issue_number} onChange={(event) => field("series_issue_number", event.target.value)} placeholder="08" required /></label>
            <label>Week / Edition Date<input type="date" value={post.series_edition_date} onChange={(event) => field("series_edition_date", event.target.value)} required /></label>
          </div>}
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Display</legend>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontWeight: 400 }}><input type="checkbox" checked={post.featured_on_homepage} onChange={(event) => field("featured_on_homepage", event.target.checked)} style={{ width: "auto" }} />Featured on Homepage</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontWeight: 400 }}><input type="checkbox" checked={post.show_in_latest} onChange={(event) => field("show_in_latest", event.target.checked)} style={{ width: "auto" }} />Show in Latest</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontWeight: 400 }}><input type="checkbox" checked={post.show_in_series_section} onChange={(event) => field("show_in_series_section", event.target.checked)} style={{ width: "auto" }} />Show in Series Section</label>
          </div>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Publishing</legend>
          <div className="two-col">
            <label>Status<input value={status === "published" ? "Published" : "Draft"} readOnly /></label>
            <label>Publish Date<input type="date" value={post.published_on} onChange={(e) => field("published_on", e.target.value)} /></label>
          </div>
          <label>Author<input value={post.author} onChange={(event) => field("author", event.target.value)} placeholder="Chévere" /></label>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Images</legend>
          <ImageField label="Hero image (top of the post, optional)" value={post.hero_image_url} onChange={(url) => field("hero_image_url", url)} disabled={busy} />
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Body</legend>
          <EditorialQuoteInsert onInsert={(markdown) => {
            field("body", post.body.trim() ? `${post.body.trim()}\n\n${markdown}` : markdown);
          }} />
          <label>Post content<textarea className="body-input" rows={22} value={post.body} onChange={(e) => field("body", e.target.value)} id="post-body-input" /></label>
          <details className="formatting-help" style={{ marginBottom: 12 }}>
            <summary>Formatting cheatsheet</summary>
            <ul>
              <li><code>## Heading</code> — a section heading</li>
              <li><code>**Bold text**</code> — a bold subheading</li>
              <li><code>*italic*</code> — italics</li>
              <li><code>[link text](https://example.com)</code> — a link</li>
              <li><code>![description](image-url)</code> — an image on its own line</li>
              <li><code>&gt; Quote</code> followed by <code>&gt; — Attribution</code> — an editorial quote block</li>
              <li>Leave a blank line between paragraphs.</li>
            </ul>
          </details>
          {Array.from({ length: imageUploadCount }).map((_, idx) => (
            <div key={idx}>
              <InlineImageUpload bodyContent={post.body} onInsert={(newBody) => {
                field("body", newBody);
              }} onAddMore={() => setImageUploadCount(c => c + 1)} />
            </div>
          ))}
          <label>Sign-off (optional)<input value={post.signoff} onChange={(e) => field("signoff", e.target.value)} /></label>
        </fieldset>

        <div className="action-bar">
          <button className="primary" disabled={busy}>Save draft</button>
          <button type="button" className="secondary" onClick={showPreview} disabled={busy}>Preview</button>
          <button type="button" className="approve" onClick={publish} disabled={busy || !id}>
            {status === "published" ? "Re-publish" : "Publish"}
          </button>
          {status === "published" && <button type="button" className="secondary" onClick={unpublish} disabled={busy}>Unpublish</button>}
        </div>
      </form>

      <aside className="preview-panel">
        <div className="preview-toolbar">
          <strong>Page preview</strong>
          {preview && (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")} style={{ fontSize: 12, padding: "5px 12px", border: "1px solid var(--line)", background: previewMode === "desktop" ? "var(--line)" : "transparent", borderRadius: 6, cursor: "pointer" }}>Desktop</button>
              <button type="button" className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")} style={{ fontSize: 12, padding: "5px 12px", border: "1px solid var(--line)", background: previewMode === "mobile" ? "var(--line)" : "transparent", borderRadius: 6, cursor: "pointer" }}>Mobile</button>
            </div>
          )}
        </div>
        {preview
          ? <iframe title="Post preview" srcDoc={preview} className={previewMode} />
          : <div className="preview-empty">Choose Preview to see the finished page.</div>}
      </aside>
    </div>
  </>;
}
