"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock3, Pause, Play } from "lucide-react";
import { formatClock, type StepTimer } from "@/lib/step-timers";
import type { Recipe } from "@/lib/recipe";
import { findPopular } from "@/lib/popular";
import { VideoThumb } from "./media";
import { useT } from "./locale";

type Player = { seekTo(seconds: number, allowSeekAhead: boolean): void; playVideo(): void; pauseVideo(): void; getCurrentTime(): number; destroy(): void };
type YouTubeApi = { Player: new (element: HTMLElement, options: Record<string, unknown>) => Player; PlayerState: { PLAYING: number } };
const page = () => window as unknown as { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };

let api: Promise<YouTubeApi> | null = null;
function loadApi() {
  // The IFrame API is fetched only after the viewer asks for the video.
  api ??= new Promise<YouTubeApi>((resolve, reject) => {
    const w = page();
    if (w.YT?.Player) return resolve(w.YT);
    // Keep any handler another component registered for the same global callback.
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { previous?.(); if (w.YT) resolve(w.YT); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { api = null; reject(new Error("YouTube API unavailable")); };
    document.head.appendChild(script);
  });
  return api;
}

type Watch = {
  videoId: string; state: "idle" | "loading" | "ready" | "error"; playing: boolean; time: number; current: number; collapsed: boolean;
  host: React.RefObject<HTMLDivElement | null>; start: (at: number) => void; toggle: () => void; setCollapsed: (value: boolean) => void;
};
const Context = createContext<Watch | null>(null);
export const useWatch = () => useContext(Context);

/** Owns the recipe video: the player on top and the timestamps in the steps share it. */
export function WatchProvider({ videoId, recipe, children }: { videoId: string; recipe: Recipe; children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const pending = useRef<number | null>(null);
  const [state, setState] = useState<Watch["state"]>("idle");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const start = useCallback(async (at: number) => {
    if (player.current) { player.current.seekTo(at, true); player.current.playVideo(); return; }
    pending.current = at;
    if (state === "loading") return;
    setState("loading");
    try {
      const YT = await loadApi();
      if (!host.current) return;
      const target = document.createElement("div");
      host.current.replaceChildren(target);
      player.current = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com", videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, start: Math.floor(pending.current ?? 0) },
        events: {
          onReady: (event: { target: Player }) => { setState("ready"); event.target.playVideo(); },
          onStateChange: (event: { data: number }) => setPlaying(event.data === YT.PlayerState.PLAYING),
          onError: () => setState("error"),
        },
      });
    } catch { setState("error"); }
  }, [state, videoId]);

  useEffect(() => {
    if (!playing) return;
    const tick = setInterval(() => setTime(player.current?.getCurrentTime() ?? 0), 400);
    return () => clearInterval(tick);
  }, [playing]);
  useEffect(() => () => player.current?.destroy(), []);

  const current = playing || time > 0 ? recipe.steps.reduce<number>((active, step, i) => step.at !== null && step.at <= time + 0.5 ? i : active, -1) : -1;
  const value = useMemo<Watch>(() => ({
    videoId, state, playing, time, current, collapsed, host, setCollapsed,
    start: at => void start(at),
    toggle: () => { if (!player.current) return void start(0); if (playing) player.current.pauseVideo(); else player.current.playVideo(); },
  }), [videoId, state, playing, time, current, collapsed, start]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function WatchPlayer({ recipe }: { recipe: Recipe }) {
  const t = useT();
  const watch = useWatch()!;
  const { state, playing, time, current, collapsed, host } = watch;
  const hasStamps = recipe.steps.some(step => step.at !== null);
  return <div className={`watch-player ${collapsed ? "is-collapsed" : ""} ${state !== "idle" ? "is-active" : ""}`}>
    <div className="watch-frame">
      <div ref={host} className="watch-host" />
      {state !== "ready" && <button className="film-facade" onClick={() => watch.start(0)} aria-label={t.watch.playAria}>
        <VideoThumb id={watch.videoId} alt="" priority variant={findPopular(watch.videoId)?.thumb} /><span className="film-play">{state === "loading" ? <span className="spinner" /> : <Play size={28} fill="currentColor" />}</span>
      </button>}
    </div>
    <div className="watch-bar">
      <button className="icon-btn" onClick={watch.toggle} aria-label={playing ? t.watch.pause : t.watch.play}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
      <div className="watch-now">
        <span>{current >= 0 ? t.watch.now(current + 1) : hasStamps ? t.watch.hint : t.watch.video}</span>
        <strong>{current >= 0 ? recipe.steps[current].title : t.recipe.watch}</strong>
      </div>
      {state === "ready" && <span className="watch-time">{formatClock(time)}</span>}
      {state !== "idle" && <button className="icon-btn watch-collapse" onClick={() => watch.setCollapsed(!collapsed)} aria-label={collapsed ? t.watch.expand : t.watch.collapse} aria-expanded={!collapsed}>
        {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>}
    </div>
    {state === "error" && <p className="watch-error">{t.watch.error} <a href={`${recipe.sourceUrl}`} target="_blank" rel="noopener noreferrer">{t.watch.open}</a>.</p>}
  </div>;
}

/** Steps with a timestamp chip that jumps the video above; the step being played lights up. */
export function WatchSteps({ recipe, done, onToggleDone, timers }: { recipe: Recipe; done: number[]; onToggleDone: (index: number) => void; timers: StepTimer[][] }) {
  const t = useT();
  const watch = useWatch();
  return <ol className="steps">
    {recipe.steps.map((step, i) => <li key={i} className={`${done.includes(i) ? "is-done" : ""} ${watch?.current === i ? "is-playing" : ""}`}>
      <button className="step-check" onClick={() => onToggleDone(i)} aria-pressed={done.includes(i)} aria-label={t.recipe.stepCheck(done.includes(i), i + 1)}>
        {done.includes(i) ? <Check size={18} strokeWidth={2.6} /> : i + 1}
      </button>
      <div>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        {((watch && step.at !== null) || timers[i].length > 0) && <div className="step-timers">
          {watch && step.at !== null && <button className="chip chip--video" onClick={() => watch.start(step.at!)} aria-label={t.watch.seek(formatClock(step.at))}>
            <Play size={11} fill="currentColor" /> {formatClock(step.at)}
          </button>}
          {timers[i].map(x => <span key={x.seconds} className="chip chip--outline"><Clock3 size={13} />{x.label}</span>)}
        </div>}
      </div>
    </li>)}
  </ol>;
}
