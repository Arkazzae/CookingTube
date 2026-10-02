"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellRing, Minus, Pause, Play, Plus, Timer, Trash2, X } from "lucide-react";
import { addTimer, extendTimer, markRinging, pauseTimer, remaining, removeTimers, resumeTimer, useTimers, type KitchenTimer } from "@/lib/kitchen-timers";
import { formatClock, formatDuration } from "@/lib/step-timers";
import { useHydrated } from "@/lib/local-library";
import { Sheet } from "./sheet";
import { useT } from "./locale";

type TimerCenter = { open: () => void; start: (label: string, seconds: number) => void };
const Context = createContext<TimerCenter>({ open: () => {}, start: () => {} });
export const useTimerCenter = () => useContext(Context);

let audio: AudioContext | null = null;
/** Browsers unlock sound only inside a user gesture, so every "start" primes the audio context. */
function primeAudio() {
  try { audio ??= new AudioContext(); void audio.resume(); } catch { /* No Web Audio: vibration and notifications still work. */ }
}
function chime() {
  navigator.vibrate?.([300, 150, 300, 150, 600]);
  if (!audio) return;
  for (let i = 0; i < 3; i++) {
    const at = audio.currentTime + i * 0.42, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(i === 2 ? 1046.5 : 880, at);
    gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
    osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + 0.4);
  }
}
const clock = () => Date.now();

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const timers = useTimers();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(clock);
  const timersRef = useRef(timers);
  useEffect(() => { timersRef.current = timers; }, [timers]);
  const active = timers.some(timer => timer.endsAt !== null || timer.ringing);

  useEffect(() => {
    if (!active) return;
    let lastChime = 0;
    const tick = setInterval(() => {
      const at = clock();
      setNow(at);
      const due = timersRef.current.filter(timer => timer.endsAt !== null && timer.endsAt <= at);
      if (due.length) {
        markRinging(due.map(timer => timer.id));
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          for (const timer of due) new Notification(t.timer.done(timer.label || t.timer.defaultLabel), { body: t.timer.ringing, icon: "/icons/app-192.png", tag: timer.id });
        }
      }
      // Keep reminding every few seconds until the cook reacts.
      if ((due.length || timersRef.current.some(timer => timer.ringing)) && at - lastChime > 2800) { lastChime = at; chime(); }
    }, 500);
    return () => clearInterval(tick);
  }, [active, t]);

  const value = useMemo<TimerCenter>(() => ({
    open: () => { primeAudio(); setOpen(true); },
    start: (label, seconds) => { primeAudio(); addTimer(label, seconds); },
  }), []);
  const ringing = timers.filter(timer => timer.ringing);
  const cooking = pathname.endsWith("/gotuj");

  return <Context.Provider value={value}>
    {children}
    {hydrated && !open && ringing.length === 0 && !cooking && timers.length > 0 && <TimerDock timers={timers} now={now} onOpen={() => setOpen(true)} />}
    {hydrated && ringing.length > 0 && <Alarm timers={ringing} />}
    <Sheet open={open} onClose={() => setOpen(false)} title={t.timer.title} description={t.timer.description} className="sheet--timer">
      <TimerPanel timers={timers} now={now} />
    </Sheet>
  </Context.Provider>;
}

function Ring({ progress, size = 36, children }: { progress: number; size?: number; children?: React.ReactNode }) {
  return <span className="ring" style={{ "--p": Math.min(1, Math.max(0, progress)), width: size, height: size } as React.CSSProperties}>{children}</span>;
}

function TimerDock({ timers, now, onOpen }: { timers: KitchenTimer[]; now: number; onOpen: () => void }) {
  const t = useT();
  const first = [...timers].sort((a, b) => remaining(a, now) - remaining(b, now))[0];
  const left = remaining(first, now);
  return <button className="timer-dock" onClick={onOpen} aria-label={`${t.timer.open}: ${first.label || t.timer.defaultLabel} ${formatClock(left)}`}>
    <Ring progress={1 - left / first.total} size={34}><Timer size={15} /></Ring>
    <span className="timer-dock-text"><b>{formatClock(left)}</b><span>{first.label || t.timer.defaultLabel}</span></span>
    {timers.length > 1 && <span className="timer-dock-more">{t.timer.dock(timers.length)}</span>}
    {first.endsAt === null && <Pause size={14} className="timer-dock-paused" />}
  </button>;
}

function Alarm({ timers }: { timers: KitchenTimer[] }) {
  const t = useT();
  const ids = timers.map(timer => timer.id);
  return <div className="alarm" role="alertdialog" aria-labelledby="alarm-title" aria-live="assertive">
    <span className="alarm-bell"><BellRing size={26} /></span>
    <div className="alarm-text">
      <span className="eyebrow eyebrow--warm">{t.timer.ringing}</span>
      <strong id="alarm-title">{timers.map(timer => timer.label || t.timer.defaultLabel).join(", ")}</strong>
    </div>
    <div className="alarm-actions">
      <button className="btn btn-secondary" onClick={() => ids.forEach(id => extendTimer(id, 60))}>{t.timer.snooze}</button>
      <button className="btn btn-primary" onClick={() => removeTimers(ids)} autoFocus>{t.timer.stop}</button>
    </div>
  </div>;
}

const presets = [1, 3, 5, 8, 10, 15, 20, 30, 45, 60];

function TimerPanel({ timers, now }: { timers: KitchenTimer[]; now: number }) {
  const t = useT();
  const { start } = useTimerCenter();
  const [seconds, setSeconds] = useState(300);
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const change = useCallback((delta: number) => setSeconds(s => Math.max(10, Math.min(5 * 3600, s + delta))), []);
  const running = [...timers].sort((a, b) => remaining(a, now) - remaining(b, now));

  return <div className="timer-panel">
    <div className="timer-setup">
      <div className="timer-dial">
        <button className="icon-btn icon-btn--surface" onClick={() => change(-60)} aria-label={t.timer.minus}><Minus size={20} /></button>
        <div className="timer-dial-face" aria-live="polite">
          <Ring progress={seconds / 3600} size={176} />
          <span className="timer-dial-time">{formatClock(seconds)}</span>
          <button className="timer-dial-plus30" onClick={() => change(30)} aria-label={t.timer.plus30}>+30 {t.timer.seconds}</button>
        </div>
        <button className="icon-btn icon-btn--surface" onClick={() => change(60)} aria-label={t.timer.plus}><Plus size={20} /></button>
      </div>
      <div className="timer-presets" role="group" aria-label={t.timer.presets}>
        {presets.map(m => <button key={m} aria-pressed={seconds === m * 60} onClick={() => setSeconds(m * 60)}>{m} {t.timer.minutes}</button>)}
      </div>
      <label className="timer-label">
        <span>{t.timer.label}</span>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder={t.timer.labelPlaceholder} maxLength={60} />
      </label>
      <div className="timer-label-chips">
        {t.timer.labels.map(name => <button key={name} aria-pressed={label === name} onClick={() => setLabel(name)}>{name}</button>)}
      </div>
      <button className="btn btn-primary btn-xl btn-block" onClick={() => { start(label || t.timer.defaultLabel, seconds); setLabel(""); }}>
        <Play size={18} fill="currentColor" /> {t.timer.start} · {formatDuration(seconds)}
      </button>
    </div>

    <section className="timer-running" aria-label={t.timer.running}>
      <h3>{t.timer.running}</h3>
      {running.length === 0 ? <p className="muted small">{t.timer.none}</p> : <ul>
        {running.map(timer => {
          const left = remaining(timer, now);
          return <li key={timer.id} className={`${timer.endsAt === null ? "is-paused" : ""} ${timer.ringing ? "is-ringing" : ""}`}>
            <Ring progress={timer.ringing ? 1 : 1 - left / timer.total} size={40}><Timer size={16} /></Ring>
            <div className="timer-running-text"><b>{timer.ringing ? t.timer.ringing : formatClock(left)}</b><span>{timer.label || t.timer.defaultLabel}</span></div>
            <button className="icon-btn" onClick={() => extendTimer(timer.id, 60)} aria-label={t.timer.addMinute}><span className="small">+1</span></button>
            {!timer.ringing && <button className="icon-btn" onClick={() => timer.endsAt === null ? resumeTimer(timer.id) : pauseTimer(timer.id)} aria-label={timer.endsAt === null ? t.timer.resume : t.timer.pause}>
              {timer.endsAt === null ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}
            </button>}
            <button className="icon-btn" onClick={() => removeTimers([timer.id])} aria-label={t.timer.remove}>{timer.ringing ? <X size={18} /> : <Trash2 size={16} />}</button>
          </li>;
        })}
      </ul>}
    </section>

    {permission !== "unsupported" && <div className="timer-notify">
      {permission === "granted" ? <p><Bell size={16} /> {t.timer.notifyOn}</p>
        : permission === "denied" ? <p className="muted"><Bell size={16} /> {t.timer.notifyBlocked}</p>
        : <button className="btn btn-ghost" onClick={async () => setPermission(await Notification.requestPermission())}><Bell size={17} /> {t.timer.notify}</button>}
      <p className="muted small">{t.timer.background}</p>
    </div>}
  </div>;
}
