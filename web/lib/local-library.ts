import { useSyncExternalStore } from "react";
import { z } from "zod";
import { recipeResultSchema, type Recipe } from "./recipe";
import { findPopular } from "./popular";

// Everything lives in this browser's localStorage: there are no accounts and no sync.
export type SavedRecipe = { id: string; recipe: Recipe; savedAt: number; favorite: boolean; cookedAt: number | null };
/** A recipe from this device, or a popular one that has not been saved here yet (saved=false). */
export type RecipeEntry = SavedRecipe & { saved: boolean };
export type Progress = { have: number[]; done: number[] };
export type ShoppingItem = { id: string; name: string; amount: string | null; recipeId: string | null; recipeTitle: string | null; checked: boolean };
type State = { recipes: SavedRecipe[]; progress: Record<string, Progress>; shopping: ShoppingItem[] };

const KEY = "cookingtube:v1";
const empty: State = { recipes: [], progress: {}, shopping: [] };
const indexes = z.array(z.number().int().nonnegative()).max(60);
const storedRecipe = z.object({
  id: z.string().regex(/^[\w-]{11}$/), savedAt: z.number(), favorite: z.boolean(), cookedAt: z.number().nullable(),
  recipe: recipeResultSchema.extend({ example: z.boolean().optional() }),
});
const storedItem = z.object({
  id: z.string().max(64), name: z.string().min(1).max(180), amount: z.string().max(150).nullable(),
  recipeId: z.string().max(20).nullable(), recipeTitle: z.string().max(200).nullable(), checked: z.boolean(),
});

let state: State | null = null;
const listeners = new Set<() => void>();

function list<T>(value: unknown, schema: z.ZodType<T>): T[] {
  // Drop only the entries that fail validation, never the whole library.
  return Array.isArray(value) ? value.flatMap(item => { const parsed = schema.safeParse(item); return parsed.success ? [parsed.data] : []; }) : [];
}
function read(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return empty;
    const progress: Record<string, Progress> = {};
    if (raw.progress && typeof raw.progress === "object") for (const [id, value] of Object.entries(raw.progress)) {
      const parsed = z.object({ have: indexes, done: indexes }).safeParse(value);
      if (parsed.success && /^[\w-]{1,20}$/.test(id)) progress[id] = parsed.data;
    }
    return { recipes: list(raw.recipes, storedRecipe), progress, shopping: list(raw.shopping, storedItem) };
  } catch { return empty; }
}
function snapshot() { return state ??= read(); }
function notify() { listeners.forEach(listener => listener()); }
function write(update: (current: State) => State) {
  state = update(snapshot());
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Private mode or full storage: keep the in-memory copy. */ }
  notify();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep several open tabs in step.
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) { state = read(); notify(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function useLibrary(): State { return useSyncExternalStore(subscribe, snapshot, () => empty); }
const never = () => () => {};
/** False during server render and hydration, so local data never causes a mismatch. */
export function useHydrated() { return useSyncExternalStore(never, () => true, () => false); }

export function findRecipe(library: State, id: string): RecipeEntry | null {
  const saved = library.recipes.find(item => item.id === id);
  if (saved) return { ...saved, saved: true };
  const popular = findPopular(id);
  return popular ? { id, recipe: popular.recipe, savedAt: 0, favorite: false, cookedAt: null, saved: false } : null;
}

export function saveRecipe(id: string, recipe: Recipe) {
  write(current => {
    const previous = current.recipes.find(item => item.id === id);
    // A regenerated recipe may have different ingredients and steps, so old checkmarks no longer apply.
    const progress = { ...current.progress };
    delete progress[id];
    return { ...current, progress, recipes: [{ id, recipe, savedAt: Date.now(), favorite: previous?.favorite ?? false, cookedAt: previous?.cookedAt ?? null }, ...current.recipes.filter(item => item.id !== id)] };
  });
}
export function removeRecipe(id: string) {
  const removed = snapshot().recipes.find(item => item.id === id);
  write(current => ({ ...current, recipes: current.recipes.filter(item => item.id !== id) }));
  return removed ?? null;
}
export function restoreRecipe(item: SavedRecipe) {
  write(current => ({ ...current, recipes: [...current.recipes.filter(r => r.id !== item.id), item].sort((a, b) => b.savedAt - a.savedAt) }));
}
/** Updates a saved recipe, first saving a popular recipe to this device if needed. */
function upsert(entry: RecipeEntry, change: (item: SavedRecipe) => SavedRecipe) {
  write(current => {
    const existing = current.recipes.find(item => item.id === entry.id);
    if (existing) return { ...current, recipes: current.recipes.map(item => item.id === entry.id ? change(item) : item) };
    return { ...current, recipes: [change({ id: entry.id, recipe: entry.recipe, savedAt: Date.now(), favorite: false, cookedAt: null }), ...current.recipes] };
  });
}
export function toggleFavorite(entry: RecipeEntry) {
  upsert(entry, item => ({ ...item, favorite: !item.favorite }));
  return snapshot().recipes.find(item => item.id === entry.id)?.favorite ?? false;
}
export function markCooked(entry: RecipeEntry) {
  upsert(entry, item => ({ ...item, cookedAt: Date.now() }));
}

export function progressOf(library: State, id: string): Progress { return library.progress[id] ?? { have: [], done: [] }; }
export function setProgress(id: string, update: Partial<Progress>) {
  write(current => ({ ...current, progress: { ...current.progress, [id]: { ...progressOf(current, id), ...update } } }));
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
/** Adds ingredients, skipping those already on the list for the same recipe. Returns how many were added. */
export function addToShopping(items: { name: string; amount: string | null }[], source: { id: string; title: string } | null) {
  const known = new Set(snapshot().shopping.filter(item => item.recipeId === (source?.id ?? null)).map(item => item.name.toLowerCase()));
  const fresh = items.filter(item => item.name.trim() && !known.has(item.name.trim().toLowerCase())).map(item => ({
    id: newId(), name: item.name.trim().slice(0, 180), amount: item.amount, recipeId: source?.id ?? null, recipeTitle: source?.title ?? null, checked: false,
  }));
  if (fresh.length) write(current => ({ ...current, shopping: [...current.shopping, ...fresh] }));
  return fresh.length;
}
export function toggleShopping(id: string) {
  write(current => ({ ...current, shopping: current.shopping.map(item => item.id === id ? { ...item, checked: !item.checked } : item) }));
}
export function removeShopping(ids: string[]) {
  const removed = snapshot().shopping.filter(item => ids.includes(item.id));
  write(current => ({ ...current, shopping: current.shopping.filter(item => !ids.includes(item.id)) }));
  return removed;
}
export function restoreShopping(items: ShoppingItem[]) {
  write(current => ({ ...current, shopping: [...current.shopping, ...items.filter(item => !current.shopping.some(s => s.id === item.id))] }));
}
