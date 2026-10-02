"use client";
import { useId, useState } from "react";
import { AlertCircle, ArrowRight, ClipboardPaste, Link2, X } from "lucide-react";
import { parseVideoId } from "@/lib/youtube-url";
import { useHydrated } from "@/lib/local-library";
import { useGeneration } from "./generation";
import { VideoThumb } from "./media";

export function LinkForm({ initial = "", autoFocus = false, variant = "hero" }: { initial?: string; autoFocus?: boolean; variant?: "hero" | "sheet" }) {
  const { start, phase } = useGeneration();
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState("");
  const canPaste = useHydrated() && !!navigator.clipboard?.readText;
  const inputId = useId();
  const id = parseVideoId(url);
  const busy = phase === "loading";

  async function submit(value = url) {
    const result = await start(value);
    if ("error" in result && !parseVideoId(value)) setError(result.error);
  }
  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return setError("Schowek jest pusty. Skopiuj link do filmu i spróbuj ponownie.");
      setUrl(text); setError(parseVideoId(text) ? "" : "To nie wygląda na link do filmu z YouTube.");
    } catch { setError("Przeglądarka nie dała dostępu do schowka. Wklej link ręcznie."); }
  }

  return <form className={`link-form link-form--${variant}`} aria-busy={busy} onSubmit={e => { e.preventDefault(); void submit(); }}>
    <label htmlFor={inputId} className="sr-only">Link do filmu z YouTube</label>
    <div className={`link-field ${error ? "has-error" : ""} ${id ? "is-valid" : ""}`}>
      <Link2 size={20} aria-hidden="true" className="link-field-icon" />
      <input id={inputId} type="url" inputMode="url" autoComplete="off" spellCheck={false} autoFocus={autoFocus}
        placeholder="Wklej link do filmu z YouTube…" value={url} disabled={busy}
        onChange={e => { setUrl(e.target.value); setError(""); }}
        onPaste={e => { const text = e.clipboardData.getData("text").trim(); if (parseVideoId(text)) { e.preventDefault(); setUrl(text); setError(""); } }}
        aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} />
      {url && !busy && <button type="button" className="field-btn" onClick={() => { setUrl(""); setError(""); }} aria-label="Wyczyść link"><X size={17} /></button>}
      {!url && canPaste && <button type="button" className="paste-btn" onClick={() => void paste()}><ClipboardPaste size={16} /> Wklej</button>}
      {url && <button type="submit" className="go-btn" disabled={busy || !url.trim()} aria-label="Przygotuj przepis"><ArrowRight size={20} /></button>}
    </div>
    {error && <p id={`${inputId}-error`} className="field-error" role="alert"><AlertCircle size={16} />{error}</p>}
    {id && !error && <div className="link-preview">
      <div className="link-preview-thumb"><VideoThumb id={id} alt="Miniatura wklejonego filmu" /></div>
      <div className="link-preview-text"><span className="eyebrow">Film rozpoznany</span><strong>Gotowy do przygotowania</strong><span>Zwykle trwa to do dwóch minut.</span></div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Przygotuj przepis <ArrowRight size={18} /></button>
    </div>}
  </form>;
}
