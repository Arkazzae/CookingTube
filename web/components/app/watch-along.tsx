"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock3, Pause, Play } from "lucide-react";
import { formatClock, type StepTimer } from "@/lib/step-timers";
import type { Recipe } from "@/lib/recipe";
import { VideoThumb } from "./media";

type Player = { seekTo(seconds: number, allowSeekAhead: boolean): void; playVideo(): void; pauseVideo(): void; getCurrentTime(): number; getPlayerState(): number; destroy(): void };
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

/** Steps with the source video on top: timestamps seek the video, and the step on screen follows playback. */
export function WatchAlong({ recipe, videoId, done, onToggleDone, timers, request }: {
  recipe: Recipe; videoId: string; done: number[]; onToggleDone: (index: number) => void; timers: StepTimer[][];
  request: { at: number; nonce: number } | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const pending = useRef<number | null>(null);
  const stamps = recipe.steps.map(step => step.at);
  const current = playing || time > 0 ? stamps.reduce<number>((active, at, i) => at !== null && at <= time + 0.5 ? i : active, -1) : -1;

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
  // A timestamp tapped elsewhere on the page (the hero's "watch" chip) arrives as a request.
  useEffect(() => {
    if (!request) return;
    const timer = setTimeout(() => void start(request.at), 0);
    return () => clearTimeout(timer);
  }, [request, start]);

  const toggle = () => { if (!player.current) return void start(0); if (playing) player.current.pauseVideo(); else player.current.playVideo(); };
  const hasStamps = stamps.some(at => at !== null);

  return <div className="watch">
    <div className={`watch-player ${collapsed ? "is-collapsed" : ""}`}>
      <div className="watch-frame">
        <div ref={host} className="watch-host" />
        {state !== "ready" && <button className="film-facade" onClick={() => void start(0)} aria-label="Odtwórz film z przepisem">
          <VideoThumb id={videoId} alt="" /><span className="film-play">{state === "loading" ? <span className="spinner" /> : <Play size={28} fill="currentColor" />}</span>
        </button>}
      </div>
      <div className="watch-bar">
        <button className="icon-btn" onClick={toggle} aria-label={playing ? "Pauza" : "Odtwórz"}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
        <div className="watch-now">
          <span>{current >= 0 ? `Teraz w filmie · krok ${current + 1}` : hasStamps ? "Dotknij czasu przy kroku, aby przewinąć film" : "Film z przepisem"}</span>
          <strong>{current >= 0 ? recipe.steps[current].title : recipe.author ?? recipe.title}</strong>
        </div>
        {state === "ready" && <span className="watch-time">{formatClock(time)}</span>}
        <button className="icon-btn watch-collapse" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? "Rozwiń film" : "Zwiń film"} aria-expanded={!collapsed}>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>
      {state === "error" && <p className="watch-error">Nie udało się wczytać filmu. <a href={`${recipe.sourceUrl}`} target="_blank" rel="noopener noreferrer">Otwórz go na YouTube</a>.</p>}
    </div>

    <ol className="steps">
      {recipe.steps.map((step, i) => <li key={i} className={`${done.includes(i) ? "is-done" : ""} ${current === i ? "is-playing" : ""}`}>
        <button className="step-check" onClick={() => onToggleDone(i)} aria-pressed={done.includes(i)} aria-label={`${done.includes(i) ? "Cofnij wykonanie" : "Oznacz jako wykonany"}: krok ${i + 1}`}>
          {done.includes(i) ? <Check size={18} strokeWidth={2.6} /> : i + 1}
        </button>
        <div>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          {(step.at !== null || timers[i].length > 0) && <div className="step-timers">
            {step.at !== null && <button className="chip chip--video" onClick={() => void start(step.at!)} aria-label={`Przewiń film do ${formatClock(step.at)}`}>
              <Play size={11} fill="currentColor" /> {formatClock(step.at)}
            </button>}
            {timers[i].map(t => <span key={t.seconds} className="chip chip--outline"><Clock3 size={13} />{t.label}</span>)}
          </div>}
        </div>
      </li>)}
    </ol>
  </div>;
}
