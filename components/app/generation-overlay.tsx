"use client";
import { useEffect, useRef, useState } from "react";
import { Link2, RotateCcw, X } from "lucide-react";
import { formatClock } from "@/lib/step-timers";
import { useGeneration } from "./generation";
import { VideoThumb } from "./media";

const tips = [
  "Odhacz składniki, które masz w kuchni — resztę jednym ruchem dodasz do listy zakupów.",
  "W trybie gotowania ekran nie zgaśnie, a czasy z kroków uruchomisz jako minutnik.",
  "Ilości, których autor nie podał w filmie, zostawiamy puste — nic nie zgadujemy.",
  "Ulubione przepisy oznacz sercem, a znajdziesz je szybciej w zakładce Ulubione.",
];

export function GenerationOverlay() {
  const { phase, videoId, error, startedAt, cancel, dismiss, start, url, openSheet } = useGeneration();
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
          <span className="eyebrow">Oglądamy film za Ciebie</span>
          <h2 id="overlay-title">Przepis się robi</h2>
          <p className="overlay-copy">Sztuczna inteligencja ogląda i słucha filmu, a potem spisuje składniki i kroki. {elapsed > 50 ? "Dłuższe filmy potrzebują więcej czasu — zostaw tę kartę otwartą." : "To zwykle trwa do dwóch minut."}</p>
        </div>
        <div className="indeterminate" aria-hidden="true"><span /></div>
        <p className="overlay-tip" key={tip}><b>Wskazówka</b>{tip}</p>
        <button className="btn btn-ghost" onClick={cancel}><X size={18} /> Anuluj</button>
      </> : <>
        <div className="error-photo" aria-hidden="true"><img src="/images/error.webp" alt="" /></div>
        <span className="eyebrow eyebrow--warm">Coś się przypaliło</span>
        <h2 id="overlay-title">Nie udało się przygotować przepisu</h2>
        <p className="overlay-copy" role="alert">{error}</p>
        <div className="overlay-actions">
          <button className="btn btn-primary" onClick={() => void start(url)}><RotateCcw size={18} /> Spróbuj ponownie</button>
          <button className="btn btn-secondary" onClick={() => { dismiss(); openSheet(url); }}><Link2 size={18} /> Zmień link</button>
        </div>
        <button className="btn btn-ghost" onClick={dismiss}>Zamknij</button>
      </>}
    </div>
  </div>;
}
