"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@/lib/media-schema";

type Props = {
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
};

function MediaAssetCard({ asset, onChange, onDelete, onSelect }: {
  asset: MediaAsset;
  onChange: (asset: MediaAsset) => void;
  onDelete: (id: string) => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [displayName, setDisplayName] = useState(asset.display_name || asset.file_name);
  const [altText, setAltText] = useState(asset.alt_text || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, alt_text: altText }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update this file.");
      onChange(data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update this file.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`Delete ${displayName || asset.file_name} from the media library?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const usage = Array.isArray(data.usages) ? ` Used by: ${data.usages.map((item: { label: string }) => item.label).join(", ")}.` : "";
        throw new Error((data.error || "Could not delete this file.") + usage);
      }
      onDelete(asset.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this file.");
    } finally { setBusy(false); }
  }

  const dirty = displayName !== asset.display_name || altText !== asset.alt_text;
  return <article className="media-library-card">
    <div className="media-library-preview">
      <img src={asset.url} alt={asset.alt_text || ""} />
      <span>{asset.provider === "filejump" ? "FileJump" : "Supabase"}</span>
    </div>
    <label>Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={busy} /></label>
    <label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} disabled={busy} placeholder="Describe the image" /></label>
    <small>{asset.mime_type} · {Math.max(1, Math.round(asset.size_bytes / 1024))} KB</small>
    {error && <p className="error-text">{error}</p>}
    <div className="media-library-card-actions">
      <button type="button" className="primary" onClick={() => onSelect({ ...asset, display_name: displayName, alt_text: altText })} disabled={busy}>Use image</button>
      <button type="button" className="secondary" onClick={save} disabled={busy || !dirty || !displayName.trim()}>{busy ? "Saving…" : "Save details"}</button>
      <button type="button" className="text-button danger-text" onClick={remove} disabled={busy}>Delete</button>
    </div>
  </article>;
}

export function MediaLibraryDialog({ onClose, onSelect }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/media?sync=1")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load the media library.");
        if (active) {
          setAssets(data.assets || []);
          setProvider(data.provider || "");
          if (data.warning) setError(`FileJump could not refresh, so saved media is shown instead. ${data.warning}`);
        }
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the media library."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setAssets((current) => [data, ...current.filter((asset) => asset.id !== data.id)]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  const visible = assets.filter((asset) => `${asset.display_name} ${asset.file_name} ${asset.alt_text}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="media-library-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="media-library-dialog" role="dialog" aria-modal="true" aria-labelledby="media-library-title">
      <header>
        <div>
          <p className="eyebrow">Shared media</p>
          <h2 id="media-library-title">Media library</h2>
          <p>{provider === "filejump" ? "Files are stored and synchronized with FileJump." : "Files use the existing Supabase image storage until FileJump is configured."}</p>
        </div>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </header>
      <div className="media-library-toolbar">
        <label>Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search images" /></label>
        <button type="button" className="primary" onClick={() => picker.current?.click()} disabled={busy}>{busy ? "Working…" : "Upload image"}</button>
        <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,image/avif" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
      </div>
      {error && <p className="message error">{error}</p>}
      <div className="media-library-grid">
        {visible.map((asset) => <MediaAssetCard
          key={asset.id}
          asset={asset}
          onSelect={(selected) => { onSelect(selected); onClose(); }}
          onChange={(changed) => setAssets((current) => current.map((item) => item.id === changed.id ? changed : item))}
          onDelete={(id) => setAssets((current) => current.filter((item) => item.id !== id))}
        />)}
        {!busy && !visible.length && <p className="media-library-empty">{assets.length ? "No files match that search." : "No media yet. Upload the first image."}</p>}
      </div>
    </section>
  </div>;
}
