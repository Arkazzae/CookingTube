"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import { useAppLocale } from "@/hooks/use-app-locale";
import { recipeResultSchema, type Recipe } from "@/lib/recipe";
import "./recipe-features.css";

const listing = z.object({ recipes: z.array(z.object({ id: z.string().regex(/^[\w-]{11}$/), title: z.string(), description: z.string(), score: z.number() })), nextOffset: z.number().int().nonnegative().nullable() });
type Entry = z.infer<typeof listing>["recipes"][number];
export function SharedRecipes({ onOpen }: { onOpen(id: string, recipe: Recipe): void | Promise<void> }) {
  const locale = useAppLocale();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const copy = sharedCopy[locale];
  const load = useCallback(async (offset = 0) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/library?lang=${locale}&offset=${offset}`, { signal: controller.signal });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || copy.unavailable);
      const result = listing.parse(data);
      setEntries(previous => offset ? [...previous, ...result.recipes] : result.recipes); setNext(result.nextOffset);
    } catch (error) { if (!controller.signal.aborted) setError(navigator.onLine && error instanceof Error ? error.message : copy.offline); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [locale, copy]);
  useEffect(() => {
    // Synchronize the initial fetch with the browser, and cancel a superseded locale.
    const timer = window.setTimeout(() => void load(), 0);
    return () => { clearTimeout(timer); request.current?.abort(); };
  }, [load]);
  async function open(id: string) {
    if (opening) return;
    setOpening(id); setError("");
    try {
      const response = await fetch(`/api/library?id=${id}&lang=${locale}`);
      const data = await response.json() as { recipe?: unknown; error?: string };
      if (!response.ok) throw new Error(data.error || copy.unavailable);
      await onOpen(id, recipeResultSchema.parse(data.recipe));
    } catch (error) { setError(error instanceof Error && navigator.onLine ? error.message : copy.offline); }
    finally { setOpening(null); }
  }
  return <section className="shared-recipes" aria-label={copy.title}>
    <div className="shared-heading"><div><h2>{copy.title}</h2><p>{copy.description}</p></div><button className="btn btn-secondary" disabled={busy || !!opening} onClick={() => void load()}><RefreshCw size={16} /> {copy.refresh}</button></div>
    {error && <p className="shared-message" role="status">{error}</p>}
    {busy && <p role="status">{copy.loading}</p>}
    {!entries.length && !busy && !error && <p className="shared-message">{copy.empty}</p>}
    <ul className="shared-list">{entries.map(entry => <li key={entry.id}><button disabled={!!opening} onClick={() => void open(entry.id)}><div><h3>{entry.title}</h3><p>{entry.description}</p></div><span>{opening === entry.id ? copy.loading : `${entry.score > 0 ? "+" : ""}${entry.score}`}<ArrowUpRight size={20} aria-hidden="true" /></span></button></li>)}</ul>
    {next !== null && <button className="btn btn-secondary" disabled={busy || !!opening} onClick={() => void load(next)}>{copy.more}</button>}
  </section>;
}
const sharedCopy = {
  pl: { title: "Wspólna biblioteka", description: "Przepisy przygotowane z filmów, gotowe do otwarcia i oceny.", refresh: "Odśwież", loading: "Wczytywanie…", empty: "Jeszcze nie ma przepisów w tym języku. Dodaj pierwszy film.", more: "Pokaż kolejne", unavailable: "Nie udało się otworzyć biblioteki.", offline: "Biblioteka wymaga internetu. Twoje zapisane przepisy pozostają na urządzeniu." },
  en: { title: "Shared library", description: "Recipes prepared from videos, ready to open and rate.", refresh: "Refresh", loading: "Loading…", empty: "No recipes in this language yet. Add the first video.", more: "Show more", unavailable: "We could not open the library.", offline: "The shared library needs an internet connection. Your saved recipes remain on this device." },
};
