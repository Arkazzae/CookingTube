"use client";
import Link from "@/components/app/app-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Heart, ListChecks, Pause, Play, Sun, Timer, X } from "lucide-react";
import { findRecipe, markCooked, progressOf, setProgress, toggleFavorite, useHydrated, useLibrary, type RecipeEntry } from "@/lib/local-library";
import { findTimers, formatClock } from "@/lib/step-timers";
import { pauseTimer, remaining, removeTimers, resumeTimer, useTimers } from "@/lib/kitchen-timers";
import { IngredientIcon, VideoThumb } from "@/components/app/media";
import { loadApi, timelineFits, type Player } from "@/components/app/watch-along";
import { findPopular } from "@/lib/popular";
import { Sheet } from "@/components/app/sheet";
import { useLocale, useT } from "@/components/app/locale";
import { useTimerCenter } from "@/components/app/timers";
import { RecipeScreen } from "./recipe";

const toggle = (list: number[], i: number) => list.includes(i) ? list.filter(n => n !== i) : [...list, i];
const clock = () => Date.now();

export function CookingScreen({ id }: { id: string }) {
  const { locale } = useLocale();
  const library = useLibrary();
  const hydrated = useHydrated();
  const item = findRecipe(library, id, locale);
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

/** Re-renders every quarter second while a timer runs, for the countdowns in the tray. */
function useNow(active: boolean) {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setNow(clock()), 250);
    return () => clearInterval(tick);
  }, [active]);
  return now;
}

function CookingView({ item }: { item: RecipeEntry }) {
  const t = useT();
  const { recipe, id } = item;
  const library = useLibrary();
  const timers = useTimers();
  const { start: startTimer, open: openTimer } = useTimerCenter();
  const { have, done } = progressOf(library, id);
  const total = recipe.steps.length;
  const [index, setIndex] = useState(() => { const first = recipe.steps.findIndex((_, i) => !done.includes(i)); return first === -1 ? 0 : first; });
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const videoId = recipe.sourceUrl?.match(/v=([\w-]{11})/)?.[1] ?? null;
  const awake = useWakeLock();
  const now = useNow(timers.some(timer => timer.endsAt !== null));
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

  return <div className={`cook ${finished ? "is-finished" : ""}`}
    onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
    onTouchEnd={e => {
      const start = touch.current; touch.current = null;
      if (!start || ingredientsOpen || (e.target instanceof Element && e.target.closest(".cook-media"))) return;
      const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
    }}>
    <header className="cook-top">
      <Link href={`/przepis/${id}`} className="icon-btn icon-btn--surface" aria-label={t.cooking.close}><X size={20} /></Link>
      <div className="cook-title">
        <span className="eyebrow">{finished ? t.cooking.done : t.cooking.stepOf(index + 1, total)}{awake && <Sun size={12} className="cook-awake" aria-label={t.cooking.awake} />}</span>
        <strong>{recipe.title}</strong>
      </div>
      <div className="cook-actions">
        <button className="icon-btn icon-btn--surface" onClick={openTimer} aria-label={t.timer.open}><Timer size={20} /></button>
        <button className="icon-btn icon-btn--surface" onClick={() => setIngredientsOpen(true)} aria-label={t.cooking.showIngredients}><ListChecks size={20} /></button>
      </div>
    </header>
    <div className="cook-progress" role="progressbar" aria-label={t.cooking.progress} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index, total)}>
      {recipe.steps.map((_, i) => <button key={i} className={i < index ? "is-done" : i === index ? "is-current" : ""} onClick={() => go(i)} aria-label={t.cooking.goTo(i + 1)} />)}
    </div>

    {finished ? <div className="cook-body cook-body--finish"><FinishView item={item} onRestart={() => go(0)} /></div> : <div className="cook-body">
      {videoId && <div className="cook-media"><CookPlayer videoId={videoId} steps={recipe.steps} index={index} knownLength={findPopular(id)?.videoSeconds ?? null} /></div>}
      <div className="cook-panel">
        {timers.length > 0 && <ul className="timer-tray" aria-label={t.cooking.timers}>
          {timers.map(timer => {
            const left = remaining(timer, now);
            return <li key={timer.id} className={`timer ${timer.ringing ? "is-finished" : ""} ${timer.endsAt === null && !timer.ringing ? "is-paused" : ""}`}>
              <button className="timer-ring" style={{ "--p": timer.ringing ? 1 : 1 - left / timer.total } as React.CSSProperties}
                onClick={() => timer.endsAt === null ? resumeTimer(timer.id) : pauseTimer(timer.id)} disabled={timer.ringing}
                aria-label={timer.endsAt === null ? t.timer.resume : t.timer.pause}>
                {timer.ringing ? <Timer size={15} /> : timer.endsAt === null ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
              </button>
              <span className="timer-text"><b>{timer.ringing ? t.cooking.finished : formatClock(left)}</b><span>{timer.label}</span></span>
              <button onClick={() => removeTimers([timer.id])} aria-label={timer.ringing ? t.cooking.closeTimer : t.cooking.cancelTimer(timer.label)}><X size={16} /></button>
            </li>;
          })}
        </ul>}
        <article className="cook-step" key={index} aria-live="polite">
          <span className="cook-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <h1>{step.title}</h1>
          <p>{step.description}</p>
          {stepTimers[index].length > 0 && <div className="cook-timers">
            {stepTimers[index].map(x => <button key={x.seconds} className="btn btn-timer" onClick={() => startTimer(t.timer.step(index + 1, step.title), x.seconds)}><Play size={16} fill="currentColor" /> {t.cooking.timer(x.label)}</button>)}
          </div>}
        </article>
      </div>
    </div>}

    {!finished && <nav className="cook-nav" aria-label={t.cooking.nav}>
      <button className="btn btn-secondary btn-xl" onClick={() => go(index - 1)} disabled={index === 0}><ArrowLeft size={20} /><span>{t.cooking.back}</span></button>
      <button className="btn btn-primary btn-xl" onClick={() => go(index + 1)}>{index === total - 1 ? <>{t.cooking.finish} <Check size={20} /></> : <>{t.cooking.next} <ArrowRight size={20} /></>}</button>
    </nav>}

    <Sheet open={ingredientsOpen} onClose={() => setIngredientsOpen(false)} title={t.recipe.ingredients} description={t.cooking.ingredientsChecked(have.length, recipe.ingredients.length)}>
      <ul className="ingredients ingredients--sheet">
        {recipe.ingredients.map((ingredient, i) => <li key={i}>
          <button className={`ingredient ${have.includes(i) ? "is-checked" : ""}`} aria-pressed={have.includes(i)} onClick={() => setProgress(id, { have: toggle(have, i) })}>
            <span className="ingredient-icon">{have.includes(i) ? <Check size={18} strokeWidth={2.6} /> : <IngredientIcon name={ingredient.name} size={22} />}</span>
            <span className="ingredient-name">{ingredient.name}</span>
            <span className={`ingredient-amount ${ingredient.amount ? "" : "is-empty"}`}>{ingredient.amount ?? t.recipe.noAmount}</span>
          </button>
        </li>)}
      </ul>
    </Sheet>
  </div>;
}

function FinishView({ item, onRestart }: { item: RecipeEntry; onRestart: () => void }) {
  const t = useT();
  return <section className="cook-finish" aria-labelledby="finish-title">
    <div className="finish-photo"><img src="/images/finished.webp" alt="" /></div>
    <span className="eyebrow">{t.cooking.finishEyebrow}</span>
    <h1 id="finish-title">{t.cooking.finishTitle}</h1>
    <p>{t.cooking.finishText(item.recipe.title)}</p>
    <div className="row-actions">
      {!item.favorite && <button className="btn btn-primary" onClick={() => { toggleFavorite(item); toast(t.cooking.favAdded); }}><Heart size={18} /> {t.cooking.addFav}</button>}
      <Link href={`/przepis/${item.id}`} className="btn btn-secondary">{t.cooking.backToRecipe}</Link>
      <button className="btn btn-ghost" onClick={onRestart}>{t.cooking.restart}</button>
    </div>
  </section>;
}

/**
 * The recipe video stays on screen for the whole cooking session. When the timeline fits inside the video,
 * moving between steps jumps it to the step's moment; it keeps playing if it was playing.
 */
function CookPlayer({ videoId, steps, index, knownLength }: { videoId: string; steps: { at: number | null }[]; index: number; knownLength: number | null }) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [length, setLength] = useState<number | null>(knownLength);
  const timeline = steps.some(step => step.at !== null) && timelineFits(steps, length);
  const at = timeline && index < steps.length ? steps[index].at : null;
  const atRef = useRef(at);
  useEffect(() => { atRef.current = at; }, [at]);
  useEffect(() => {
    const current = player.current;
    if (!current || state !== "ready" || at === null) return;
    const playing = current.getPlayerState() === 1;
    current.seekTo(at, true);
    if (!playing) current.pauseVideo();
  }, [at, state]);
  useEffect(() => () => player.current?.destroy(), []);

  async function start() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const YT = await loadApi();
      if (!host.current) return;
      const target = document.createElement("div");
      host.current.replaceChildren(target);
      player.current = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com", videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, start: Math.floor(atRef.current ?? 0) },
        events: {
          onReady: (event: { target: Player }) => { setState("ready"); setLength(event.target.getDuration() || null); event.target.playVideo(); },
          onError: () => setState("error"),
        },
      });
    } catch { setState("error"); }
  }

  return <div className="cook-player">
    <div className="watch-frame">
      <div ref={host} className="watch-host" />
      {state !== "ready" && <button className="film-facade" onClick={() => void start()} aria-label={t.watch.playAria}>
        <VideoThumb id={videoId} alt="" priority variant={findPopular(videoId)?.thumb} /><span className="film-play">{state === "loading" ? <span className="spinner" /> : <Play size={28} fill="currentColor" />}</span>
      </button>}
    </div>
    <p className="cook-player-caption">{state === "error" ? t.watch.error : at !== null ? t.cooking.stepMoment(formatClock(at)) : timeline ? t.cooking.noMoment : t.cooking.noTimeline}</p>
  </div>;
}
