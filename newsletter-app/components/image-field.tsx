"use client";

import { useRef, useState } from "react";
import { MediaLibraryDialog } from "@/components/media-library-dialog";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

/** Image input that accepts a pasted or dropped image as well as a typed URL.
 *  Pasted files are uploaded first so the field always holds an absolute URL,
 *  which is what the email template needs. */
export function ImageField({ label, value, onChange, disabled }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  function takeFirstImage(files: FileList | null | undefined) {
    const file = Array.from(files || []).find((item) => item.type.startsWith("image/"));
    if (!file) return false;
    void upload(file);
    return true;
  }

  const idle = !disabled && !busy;
  return (
    <div
      className={`image-field${dragging ? " dragging" : ""}`}
      onPaste={(event) => { if (idle && takeFirstImage(event.clipboardData.files)) event.preventDefault(); }}
      onDragOver={(event) => { if (idle) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { if (idle) { event.preventDefault(); setDragging(false); takeFirstImage(event.dataTransfer.files); } }}
    >
      <label>{label}
        <input
          type="url"
          placeholder="Paste an image, drop a file, or enter a URL"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || busy}
        />
      </label>
      <div className="image-field-actions">
        <button type="button" className="text-button" onClick={() => picker.current?.click()} disabled={disabled || busy}>
          {busy ? "Uploading…" : "Choose file"}
        </button>
        <button type="button" className="text-button" onClick={() => setLibraryOpen(true)} disabled={disabled || busy}>Browse media</button>
        {value && !busy && (
          <button type="button" className="text-button" onClick={() => { setError(""); onChange(""); }} disabled={disabled}>Remove</button>
        )}
        <span className="image-field-hint">PNG, JPEG, GIF, WebP, HEIC, HEIF, or AVIF up to 5 MB</span>
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => { takeFirstImage(event.target.files); event.target.value = ""; }}
      />
      {error && <p className="image-field-error error-text">{error}</p>}
      {value && !error && <img className="image-field-thumb" src={value} alt="" onError={() => setError("That image URL could not be loaded.")} />}
      {libraryOpen && <MediaLibraryDialog onClose={() => setLibraryOpen(false)} onSelect={(asset) => { setError(""); onChange(asset.url); }} />}
    </div>
  );
}
