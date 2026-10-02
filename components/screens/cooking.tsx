"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BellRing, Check, Heart, ListChecks, Play, Sun, Timer, Video, X } from "lucide-react";
import { findRecipe, markCooked, progressOf, setProgress, toggleFavorite, useHydrated, useLibrary, type RecipeEntry } from "@/lib/local-library";
import { findTimers, formatClock, type StepTimer } from "@/lib/step-timers";
import { IngredientIcon } from "@/components/app/media";
import { Sheet } from "@/components/app/sheet";
import { RecipeScreen } from "./recipe";

type ActiveTimer = { key: string; label: string; step: number; endsAt: number; total: number; finished: boolean };
const toggle = (list: number[], i: number) => list.includes(i) ? list.filter(n => n !== i) : [...list, i];
const clock = () => Date.now();

export function CookingScreen({ id }: { id: string }) {
  const library = useLibrary();
  const hydrated = useHydrated();
  const item = findRecipe(library, id);
  if (!hydrated) return <div className="cook" aria-busy="true" />;
  if (!item) return <RecipeScreen id={id} />;
  return <CookingView item={item} />;
}

function useWakeLock() {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null, disposed = false;
    async function acquire() {
      if (disposed || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (disposed) { void lock.release(); return; }
        setAwake(true);
        lock.addEventListener("release", () => setAwake(false));
      } catch { setAwake(false); }
    }
    void acquire();
    // The browser drops the lock whenever the tab is hidden; take it again on return.
    document.addEventListener("visibilitychange", acquire);
    return () => { disposed = true; document.removeEventListener("visibilitychange", acquire); void lock?.release(); };
  }, []);
  return awake;
}

function useChime() {
  const context = useRef<AudioContext | null>(null);
  const prime = useCallback(() => {
    // Audio must be unlocked by a user gesture, so this runs when a timer is started.
    context.current ??= new AudioContext();
    void context.current.resume();
  }, []);
  const ring = useCallback(() => {
    const audio = context.current;
    navigator.vibrate?.([300, 150, 300, 150, 600]);
    if (!audio) return;
    for (let i = 0; i < 3; i++) {
      const at = audio.currentTime + i * 0.45, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(i === 2 ? 1046 : 880, at);
      gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
      osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + 0.4);
    }
  }, []);
  return { prime, ring };
}

function CookingView({ item }: { item: RecipeEntry }) {
  const { recipe, id } = item;
  const library = useLibrary();
  const { have, done } = progressOf(library, id);
  const total = recipe.steps.length;
  const [index, setIndex] = useState(() => { const first = recipe.steps.findIndex((_, i) => !done.includes(i)); return first === -1 ? 0 : first; });
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoId = recipe.sourceUrl?.match(/v=([\w-]{11})/)?.[1] ?? null;
  const awake = useWakeLock();
  const { prime, ring } = useChime();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const stepTimers = useMemo(() => recipe.steps.map(step => findTimers(`${step.title}. ${step.description}`)), [recipe.steps]);
  const finished = index >= total;
  const step = recipe.steps[Math.min(index, total - 1)];

  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(total, next));
    if (target > index) {
      const passed = Array.from({ length: target - index }, (_, k) => index + k).filter(i => i < total);
      setProgress(id, { done: [...new Set([...progressOf(library, id).done, ...passed])] });
      if (target === total) markCooked(item);
    }
    setIndex(target);
    window.scrollTo({ top: 0 });
  }, [index, total, id, library, item]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || (e.target instanceof Element && e.target.closest("input, textarea, dialog"))) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(index + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(index - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const timersRef = useRef(timers);
  useEffect(() => { timersRef.current = timers; }, [timers]);
  const running = timers.some(t => !t.finished);
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      const at = Date.now();
      setNow(at);
      const due = timersRef.current.filter(t => !t.finished && t.endsAt <= at).map(t => t.key);
      if (!due.length) return;
      ring();
      timersRef.current.filter(t => due.includes(t.key)).forEach(t => toast(`Minutnik ${t.label} — gotowe!`, { description: `Krok ${t.step + 1}: ${recipe.steps[t.step].title}`, duration: 15000, icon: <BellRing size={18} /> }));
      timersRef.current = timersRef.current.map(t => due.includes(t.key) ? { ...t, finished: true } : t);
      setTimers(list => list.map(t => due.includes(t.key) ? { ...t, finished: true } : t));
    }, 250);
    return () => clearInterval(tick);
  }, [running, ring, recipe.steps]);

  function startTimer(timer: StepTimer, stepIndex: number) {
    prime();
    const at = clock();
    setNow(at);
    setTimers(list => [...list, { key: `${stepIndex}-${timer.seconds}-${at}`, label: timer.label, step: stepIndex, endsAt: at + timer.seconds * 1000, total: timer.seconds, finished: false }]);
  }
  const removeTimer = (key: string) => setTimers(list => list.filter(t => t.key !== key));

  return <div className="cook"
    onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
    onTouchEnd={e => {
      const start = touch.current; touch.current = null;
      if (!start || ingredientsOpen) return;
      const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
    }}>
    <header className="cook-top">
      <Link href={`/przepis/${id}`} className="icon-btn icon-btn--surface" aria-label="Zakończ gotowanie i wróć do przepisu"><X size={20} /></Link>
      <div className="cook-title">
        <span className="eyebrow">{finished ? "Gotowe" : `Krok ${index + 1} z ${total}`}</span>
        <strong>{recipe.title}</strong>
      </div>
      <div className="cook-actions">
        {videoId && <button className={`icon-btn icon-btn--surface ${showVideo ? "is-on" : ""}`} onClick={() => setShowVideo(v => !v)} aria-pressed={showVideo} aria-label={showVideo ? "Ukryj film" : "Pokaż film do tego kroku"}><Video size={20} /></button>}
        <button className="icon-btn icon-btn--surface" onClick={() => setIngredientsOpen(true)} aria-label="Pokaż składniki"><ListChecks size={20} /></button>
      </div>
    </header>
    <div className="cook-progress" role="progressbar" aria-label="Postęp gotowania" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index, total)}>
      {recipe.steps.map((_, i) => <button key={i} className={i < index ? "is-done" : i === index ? "is-current" : ""} onClick={() => go(i)} aria-label={`Przejdź do kroku ${i + 1}`} />)}
    </div>
    {awake && <p className="cook-awake"><Sun size={14} /> Ekran nie zgaśnie podczas gotowania</p>}

    {timers.length > 0 && <ul className="timer-tray" aria-label="Minutniki">
      {timers.map(t => {
        const left = Math.max(0, (t.endsAt - now) / 1000);
        return <li key={t.key} className={`timer ${t.finished ? "is-finished" : ""}`}>
          <span className="timer-ring" style={{ "--p": t.finished ? 1 : 1 - left / t.total } as React.CSSProperties}><Timer size={15} /></span>
          <span className="timer-text"><b>{t.finished ? "Gotowe!" : formatClock(left)}</b><span>Krok {t.step + 1} · {t.label}</span></span>
          <button onClick={() => removeTimer(t.key)} aria-label={t.finished ? "Zamknij minutnik" : `Anuluj minutnik ${t.label}`}><X size={16} /></button>
        </li>;
      })}
    </ul>}

    {showVideo && videoId && !finished && <StepVideo videoId={videoId} steps={recipe.steps} index={index} />}

    {finished ? <FinishView item={item} onRestart={() => go(0)} /> : <article className="cook-step" key={index} aria-live="polite">
      <span className="cook-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <h1>{step.title}</h1>
      <p>{step.description}</p>
      {(stepTimers[index].length > 0 || (step.at !== null && videoId && !showVideo)) && <div className="cook-timers">
        {stepTimers[index].map(t => <button key={t.seconds} className="btn btn-timer" onClick={() => startTimer(t, index)}><Play size={16} fill="currentColor" /> Minutnik {t.label}</button>)}
        {step.at !== null && videoId && !showVideo && <button className="btn btn-secondary" onClick={() => setShowVideo(true)}><Video size={17} /> Zobacz ten krok w filmie</button>}
      </div>}
    </article>}

    {!finished && <nav className="cook-nav" aria-label="Kroki">
      <button className="btn btn-secondary btn-xl" onClick={() => go(index - 1)} disabled={index === 0}><ArrowLeft size={20} /><span>Wstecz</span></button>
      <button className="btn btn-primary btn-xl" onClick={() => go(index + 1)}>{index === total - 1 ? <>Zakończ <Check size={20} /></> : <>Dalej <ArrowRight size={20} /></>}</button>
    </nav>}

    <Sheet open={ingredientsOpen} onClose={() => setIngredientsOpen(false)} title="Składniki" description={`${have.length} z ${recipe.ingredients.length} odhaczonych`}>
      <ul className="ingredients ingredients--sheet">
        {recipe.ingredients.map((ingredient, i) => <li key={i}>
          <button className={`ingredient ${have.includes(i) ? "is-checked" : ""}`} aria-pressed={have.includes(i)} onClick={() => setProgress(id, { have: toggle(have, i) })}>
            <span className="ingredient-icon">{have.includes(i) ? <Check size={18} strokeWidth={2.6} /> : <IngredientIcon name={ingredient.name} size={22} />}</span>
            <span className="ingredient-name">{ingredient.name}</span>
            <span className={`ingredient-amount ${ingredient.amount ? "" : "is-empty"}`}>{ingredient.amount ?? "bez ilości"}</span>
          </button>
        </li>)}
      </ul>
    </Sheet>
  </div>;
}

function FinishView({ item, onRestart }: { item: RecipeEntry; onRestart: () => void }) {
  return <section className="cook-finish" aria-labelledby="finish-title">
    <div className="finish-photo"><img src="/images/finished.webp" alt="" /></div>
    <span className="eyebrow">Wszystkie kroki za Tobą</span>
    <h1 id="finish-title">Smacznego!</h1>
    <p>{item.recipe.title} gotowe. Mamy nadzieję, że smakuje tak dobrze jak na filmie.</p>
    <div className="row-actions">
      {!item.favorite && <button className="btn btn-primary" onClick={() => { toggleFavorite(item); toast("Dodano do ulubionych"); }}><Heart size={18} /> Dodaj do ulubionych</button>}
      <Link href={`/przepis/${item.id}`} className="btn btn-secondary">Wróć do przepisu</Link>
      <button className="btn btn-ghost" onClick={onRestart}>Od początku</button>
    </div>
  </section>;
}

/** The source video cut to the current step: it starts at the step's timestamp and stops where the next step begins. */
function StepVideo({ videoId, steps, index }: { videoId: string; steps: { at: number | null }[]; index: number }) {
  const at = steps[index].at;
  const next = steps.slice(index + 1).find(step => step.at !== null && at !== null && step.at > at)?.at ?? null;
  if (at === null) return <p className="cook-video-missing">Dla tego kroku nie mamy momentu w filmie.</p>;
  const params = new URLSearchParams({ start: String(Math.floor(at)), autoplay: "1", rel: "0", playsinline: "1", ...(next !== null ? { end: String(Math.ceil(next)) } : {}) });
  return <div className="cook-video">
    <iframe key={index} src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`} title={`Film: krok ${index + 1}`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    <p>Fragment {formatClock(at)}{next !== null ? `–${formatClock(next)}` : ""} · zmienia się razem z krokiem</p>
  </div>;
}
