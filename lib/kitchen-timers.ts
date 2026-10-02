import { useSyncExternalStore } from "react";
import { z } from "zod";

// Kitchen timers live in localStorage, so they survive navigation and reloads. A running timer stores its
// end time; a paused one stores the seconds left. Ringing timers stay until the cook stops or snoozes them.
export type KitchenTimer = { id: string; label: string; total: number; endsAt: number | null; left: number; ringing: boolean };

const KEY = "cookingtube:timers";
const schema = z.array(z.object({
  id: z.string().max(64), label: z.string().max(160), total: z.number().positive().max(86400),
  endsAt: z.number().nullable(), left: z.number().min(0).max(86400), ringing: z.boolean(),
})).max(20);
const empty: KitchenTimer[] = [];
let state: KitchenTimer[] | null = null;
const listeners = new Set<() => void>();

function read(): KitchenTimer[] {
  try { const parsed = schema.safeParse(JSON.parse(localStorage.getItem(KEY) || "[]")); return parsed.success ? parsed.data : empty; }
  catch { return empty; }
}
const snapshot = () => state ??= read();
function write(update: (current: KitchenTimer[]) => KitchenTimer[]) {
  state = update(snapshot());
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Keep the in-memory copy. */ }
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) { state = read(); listeners.forEach(l => l()); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
export const useTimers = () => useSyncExternalStore(subscribe, snapshot, () => empty);

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const remaining = (timer: KitchenTimer, now: number) => timer.endsAt === null ? timer.left : Math.max(0, (timer.endsAt - now) / 1000);

export function addTimer(label: string, seconds: number) {
  const total = Math.max(1, Math.min(86400, Math.round(seconds)));
  write(current => [...current, { id: newId(), label: label.trim().slice(0, 160), total, endsAt: Date.now() + total * 1000, left: total, ringing: false }].slice(-20));
}
export function pauseTimer(id: string) {
  const now = Date.now();
  write(current => current.map(t => t.id === id && t.endsAt !== null ? { ...t, left: remaining(t, now), endsAt: null } : t));
}
export function resumeTimer(id: string) {
  const now = Date.now();
  write(current => current.map(t => t.id === id && t.endsAt === null ? { ...t, endsAt: now + t.left * 1000 } : t));
}
/** Adds time to a running or paused timer, or restarts a ringing one for that long (snooze). */
export function extendTimer(id: string, seconds: number) {
  const now = Date.now();
  write(current => current.map(t => {
    if (t.id !== id) return t;
    if (t.ringing) return { ...t, ringing: false, total: seconds, left: seconds, endsAt: now + seconds * 1000 };
    return t.endsAt === null ? { ...t, left: t.left + seconds, total: t.total + seconds } : { ...t, endsAt: t.endsAt + seconds * 1000, total: t.total + seconds };
  }));
}
export function removeTimers(ids: string[]) { write(current => current.filter(t => !ids.includes(t.id))); }
export function markRinging(ids: string[]) {
  write(current => current.map(t => ids.includes(t.id) ? { ...t, ringing: true, endsAt: null, left: 0 } : t));
}
