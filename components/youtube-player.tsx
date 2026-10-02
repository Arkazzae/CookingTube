"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import { useAppLocale } from "@/hooks/use-app-locale";
import "./recipe-features.css";
type Player = { seekTo(seconds: number, allowSeekAhead: boolean): void; playVideo(): void; destroy(): void; getDuration(): number };
type YouTubeApi = { Player: new (element: HTMLElement, options: {
  videoId: string; host: string; width: string; height: string;
  playerVars: { origin: string; playsinline: number; rel: number };
  events: { onReady(event: { target: Player }): void; onError(): void };
}) => Player };
declare global { interface Window { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void } }
let loading: Promise<YouTubeApi> | undefined;
function loadApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => reject(new Error("YouTube timeout")), 15000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); clearTimeout(timer); if (window.YT) resolve(window.YT); };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { clearTimeout(timer); reject(new Error("YouTube unavailable")); };
    document.head.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}
export type YouTubeHandle = { seek(seconds: number): void };
export const YouTubePlayer = forwardRef<YouTubeHandle, { id: string; title: string }>(function YouTubePlayer({ id, title }, ref) {
  const locale = useAppLocale();
  const copy = playerCopy[locale];
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const queued = useRef<number | null>(null);
  const [status, setStatus] = useState<keyof typeof playerCopy.en>("loading");
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  useImperativeHandle(ref, () => ({ seek(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    setAt(Math.floor(seconds));
    container.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    if (!player.current) { queued.current = seconds; return; }
    if (seconds >= player.current.getDuration() && player.current.getDuration() > 0) { setStatus("outOfBounds"); return; }
    player.current.seekTo(seconds, true); player.current.playVideo();
    setStatus("seeked");
  } }), []);
  useEffect(() => {
    let cancelled = false;
    let instance: Player | undefined;
    const host = container.current;
    const element = document.createElement("div");
    host?.appendChild(element);
    void loadApi().then(api => {
      if (cancelled) return;
      instance = new api.Player(element, {
        videoId: id, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%",
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0 },
        events: {
          onReady(event) {
            if (cancelled) return;
            player.current = event.target; setStatus("ready");
            host?.querySelector("iframe")?.setAttribute("title", `${copy.film}: ${title}`);
            if (queued.current !== null) {
              const seconds = queued.current; queued.current = null;
              const duration = event.target.getDuration();
              if (!duration || seconds < duration) { event.target.seekTo(seconds, true); event.target.playVideo(); }
            }
          },
          onError() { if (!cancelled) { setFailed(true); setStatus("unavailable"); } },
        },
      });
    }).catch(() => { if (!cancelled) { setFailed(true); setStatus("offline"); } });
    return () => { cancelled = true; player.current = null; instance?.destroy(); element.remove(); };
  }, [id, title, copy]);
  return <section className="video-section" aria-label={copy.film}>
    <div className={`video-frame${failed ? " video-failed" : ""}`} ref={container} />
    <div className="video-caption"><p role="status">{copy[status]}</p><a href={`https://www.youtube.com/watch?v=${id}&t=${at}s`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> {copy.open}</a></div>
    <p className="section-hint">{copy.notice}</p>
  </section>;
});

const playerCopy = {
 pl: { loading: "Ładowanie odtwarzacza…", ready: "Kliknij czas przy kroku, aby przejść do tego momentu.", seeked: "Przeniesiono do wybranego etapu.", outOfBounds: "Ten znacznik wykracza poza film. Wybierz moment ręcznie w odtwarzaczu.", unavailable: "Autor nie pozwala odtworzyć filmu tutaj lub film jest niedostępny. Otwórz go na YouTube.", offline: "Nie udało się połączyć z YouTube. Sprawdź internet albo otwórz film na YouTube.", film: "Film do przepisu", open: "Otwórz na YouTube", notice: "Momenty etapów wskazuje AI i mogą być niedokładne. Sprawdź czynność w filmie." },
 en: { loading: "Loading player…", ready: "Select a time next to a step to jump to that moment.", seeked: "Jumped to the selected step.", outOfBounds: "This timestamp is beyond the video. Choose the moment manually in the player.", unavailable: "Embedding is disabled or the video is unavailable. Open it on YouTube.", offline: "Could not connect to YouTube. Check your connection or open the video on YouTube.", film: "Recipe video", open: "Open on YouTube", notice: "Step timestamps are suggested by AI and may be approximate. Check the action in the video." },
};
