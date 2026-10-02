"use client";
import { useId, useState } from "react";
import { AlertCircle, ArrowRight, ClipboardPaste, Link2, X } from "lucide-react";
import { parseVideoId } from "@/lib/youtube-url";
import { useHydrated } from "@/lib/local-library";
import { useGeneration } from "./generation";
import { VideoThumb } from "./media";
import { useLocale } from "./locale";

export function LinkForm({ initial = "", autoFocus = false, variant = "hero" }: { initial?: string; autoFocus?: boolean; variant?: "hero" | "sheet" }) {
  const { start, phase, quota } = useGeneration();
  const { t, locale } = useLocale();
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
      if (!text) return setError(t.form.clipboardEmpty);
      setUrl(text); setError(parseVideoId(text) ? "" : t.form.notYoutube);
    } catch { setError(t.form.clipboardDenied); }
  }

  return <form className={`link-form link-form--${variant}`} aria-busy={busy} onSubmit={e => { e.preventDefault(); void submit(); }}>
    <label htmlFor={inputId} className="sr-only">{t.form.label}</label>
    <div className={`link-field ${error ? "has-error" : ""} ${id ? "is-valid" : ""}`}>
      <Link2 size={20} aria-hidden="true" className="link-field-icon" />
      <input id={inputId} type="url" inputMode="url" autoComplete="off" spellCheck={false} autoFocus={autoFocus}
        placeholder={t.form.placeholder} value={url} disabled={busy}
        onChange={e => { setUrl(e.target.value); setError(""); }}
        onPaste={e => { const text = e.clipboardData.getData("text").trim(); if (parseVideoId(text)) { e.preventDefault(); setUrl(text); setError(""); } }}
        aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} />
      {url && !busy && <button type="button" className="field-btn" onClick={() => { setUrl(""); setError(""); }} aria-label={t.form.clear}><X size={17} /></button>}
      {!url && canPaste && <button type="button" className="paste-btn" onClick={() => void paste()}><ClipboardPaste size={16} /> {t.form.paste}</button>}
      {url && <button type="submit" className="go-btn" disabled={busy || !url.trim()} aria-label={t.form.submit}><ArrowRight size={20} /></button>}
    </div>
    {error && <p id={`${inputId}-error`} className="field-error" role="alert"><AlertCircle size={16} />{error}</p>}
    {quota && quota.limit > 0 && !error && <p className={`quota-note ${quota.remaining ? "" : "is-out"}`} aria-live="polite">
      {quota.remaining ? t.limit.left(quota.remaining, quota.limit) : t.limit.none(resetText(quota.resetAt, locale, t))}
    </p>}
    {id && !error && <div className="link-preview">
      <div className="link-preview-thumb"><VideoThumb id={id} alt={t.form.thumbAlt} /></div>
      <div className="link-preview-text"><span className="eyebrow">{t.form.recognized}</span><strong>{t.form.ready}</strong><span>{t.form.duration}</span></div>
      <button type="submit" className="btn btn-primary" disabled={busy}>{t.form.submit} <ArrowRight size={18} /></button>
    </div>}
  </form>;
}

function resetText(resetAt: number | null, locale: string, t: ReturnType<typeof useLocale>["t"]) {
  if (!resetAt) return t.limit.tomorrow("");
  const date = new Date(resetAt), time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString() ? t.limit.at(time) : t.limit.tomorrow(time);
}
