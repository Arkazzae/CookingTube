"use client";
import { useEffect, useRef, useState } from "react";
import { Link2, RotateCcw, X } from "lucide-react";
import { formatClock } from "@/lib/step-timers";
import { useGeneration } from "./generation";
import { VideoThumb } from "./media";
import { useT } from "./locale";


export function GenerationOverlay() {
  const { phase, videoId, error, startedAt, cancel, dismiss, start, url, openSheet } = useGeneration();
  const t = useT();
  const tips = t.overlay.tips;
  const [now, setNow] = useState(() => Date.now());
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (phase !== "idle") panelRef.current?.focus(); }, [phase]);
  if (phase === "idle") return null;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const tip = tips[Math.floor(elapsed / 7) % tips.length];

  return <div className={`overlay overlay--${phase}`} role="dialog" aria-modal="true" aria-labelledby="overlay-title">
    <div className="overlay-backdrop" aria-hidden="true">
      {phase === "loading" && videoId ? <VideoThumb id={videoId} /> : <img src={phase === "error" ? "/images/error.webp" : "/images/loading.webp"} alt="" />}
    </div>
    <div className="overlay-panel" ref={panelRef} tabIndex={-1}>
      {phase === "loading" ? <>
        <div className="scan-card" aria-hidden="true">
          {videoId && <VideoThumb id={videoId} priority />}
          <span className="scan-beam" />
          <span className="scan-time">{formatClock(elapsed)}</span>
        </div>
        <div role="status" aria-live="polite">
          <span className="eyebrow">{t.overlay.eyebrow}</span>
          <h2 id="overlay-title">{t.overlay.title}</h2>
          <p className="overlay-copy">{t.overlay.copy} {elapsed > 50 ? t.overlay.long : t.overlay.short}</p>
        </div>
        <div className="indeterminate" aria-hidden="true"><span /></div>
        <p className="overlay-tip" key={tip}><b>{t.overlay.tip}</b>{tip}</p>
        <button className="btn btn-ghost" onClick={cancel}><X size={18} /> {t.overlay.cancel}</button>
      </> : <>
        <div className="error-photo" aria-hidden="true"><img src="/images/error.webp" alt="" /></div>
        <span className="eyebrow eyebrow--warm">{t.overlay.burnt}</span>
        <h2 id="overlay-title">{t.overlay.failTitle}</h2>
        <p className="overlay-copy" role="alert">{error}</p>
        <div className="overlay-actions">
          <button className="btn btn-primary" onClick={() => void start(url)}><RotateCcw size={18} /> {t.overlay.retry}</button>
          <button className="btn btn-secondary" onClick={() => { dismiss(); openSheet(url); }}><Link2 size={18} /> {t.overlay.changeLink}</button>
        </div>
        <button className="btn btn-ghost" onClick={dismiss}>{t.overlay.close}</button>
      </>}
    </div>
  </div>;
}
