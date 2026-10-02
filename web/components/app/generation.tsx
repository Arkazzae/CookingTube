"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recipeResultSchema } from "@/lib/recipe";
import { parseVideoId } from "@/lib/youtube-url";
import { saveRecipe } from "@/lib/local-library";

type Phase = "idle" | "loading" | "error";
type Result = { error: string } | { title: string; ingredients: number; steps: number };
type Generation = {
  phase: Phase; url: string; videoId: string | null; error: string; startedAt: number;
  start: (url: string) => Promise<Result>; cancel: () => void; dismiss: () => void;
  sheetOpen: boolean; openSheet: (url?: string) => void; closeSheet: () => void; draft: string;
};
const Context = createContext<Generation | null>(null);
export function useGeneration() {
  const value = useContext(Context);
  if (!value) throw new Error("useGeneration requires GenerationProvider");
  return value;
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const start = useCallback(async (value: string): Promise<Result> => {
    if (requestRef.current) return { error: "Przepis już się przygotowuje." };
    const id = parseVideoId(value);
    if (!id) return { error: "Wklej pełny link do filmu z YouTube." };
    const controller = new AbortController(); requestRef.current = controller;
    setUrl(value); setError(""); setSheetOpen(false); setStartedAt(Date.now()); setPhase("loading");
    const timeout = setTimeout(() => controller.abort(new Error("Przygotowanie trwało zbyt długo. Spróbuj ponownie.")), 145000);
    try {
      const response = await fetch("/api/recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }), signal: controller.signal });
      const data = await response.json().catch(() => null) as { recipe?: unknown; error?: string } | null;
      if (!data || typeof data !== "object") throw new Error("Nie udało się odczytać odpowiedzi. Spróbuj ponownie za chwilę.");
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Nie udało się przygotować przepisu. Spróbuj ponownie.");
      const parsed = recipeResultSchema.safeParse(data.recipe);
      if (!parsed.success) throw new Error("Nie udało się odczytać przepisu. Spróbuj ponownie.");
      if (controller.signal.aborted) throw new DOMException("Anulowano", "AbortError");
      saveRecipe(id, parsed.data);
      router.push(`/przepis/${id}`);
      setPhase("idle");
      return { title: parsed.data.title, ingredients: parsed.data.ingredients.length, steps: parsed.data.steps.length };
    } catch (err) {
      if (controller.signal.aborted && !(controller.signal.reason instanceof Error && controller.signal.reason.name !== "AbortError")) {
        setPhase("idle");
        return { error: "Przygotowywanie anulowane. Możesz spróbować ponownie." };
      }
      const message = controller.signal.aborted && controller.signal.reason instanceof Error ? controller.signal.reason.message
        : err instanceof Error ? err.message : "Coś poszło nie tak. Spróbuj ponownie.";
      setError(message); setPhase("error");
      return { error: message };
    } finally { clearTimeout(timeout); if (requestRef.current === controller) requestRef.current = null; }
  }, [router]);

  // Optional WebMCP capability: lets a browser agent use the same action as the visible form.
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { Promise.resolve(context.registerTool({
      name: "create_recipe_from_youtube", title: "Przygotuj przepis z filmu",
      description: "Generate a Polish cooking recipe from a public YouTube video, save it on this device and show it. Sends the video URL for analysis. Uses the same action as the visible form.",
      inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input: unknown) => {
        if (!input || typeof input !== "object" || !("url" in input) || typeof input.url !== "string") return { error: "Podaj link do filmu." };
        return start(input.url);
      },
    }, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, [start]);

  const value = useMemo<Generation>(() => ({
    phase, url, videoId: parseVideoId(url), error, startedAt, start, sheetOpen, draft,
    cancel: () => requestRef.current?.abort(),
    dismiss: () => { setPhase("idle"); setError(""); },
    openSheet: (next = "") => { setDraft(next); setSheetOpen(true); },
    closeSheet: () => setSheetOpen(false),
  }), [phase, url, error, startedAt, start, sheetOpen, draft]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
