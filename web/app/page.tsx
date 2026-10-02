"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, SquarePlay, Link2, CookingPot, Check, Clock3, Users, Play, RotateCcw, AlertCircle, Leaf, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { recipeResultSchema, sampleRecipe, type Recipe } from "@/lib/recipe";
import { parseVideoId } from "@/lib/youtube-url";
type Phase = "idle" | "loading" | "result";
export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  useEffect(() => () => { requestRef.current?.abort(); }, []);
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setInterval(() => setElapsed(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (phase === "result") resultRef.current?.focus({ preventScroll: true }); }, [phase]);
  const generate = useCallback(async (value: string) => {
    if (requestRef.current) return { error: "Przepis już się przygotowuje." };
    if (!parseVideoId(value)) { const message = "Wklej pełny link do filmu z YouTube."; setError(message); return { error: message }; }
    const controller = new AbortController(); requestRef.current = controller;
    setUrl(value); setError(""); setPhase("loading"); setElapsed(0); setChecked([]); setCompleted([]);
    const timeout = setTimeout(() => controller.abort(new Error("Przygotowanie trwało zbyt długo. Spróbuj ponownie.")), 145000);
    try {
      const response = await fetch("/api/recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }), signal: controller.signal });
      const data = await response.json().catch(() => null) as { recipe?: unknown; error?: string } | null;
      if (!data || typeof data !== "object") throw new Error("Nie udało się odczytać odpowiedzi. Spróbuj ponownie za chwilę.");
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Nie udało się przygotować przepisu. Spróbuj ponownie.");
      const parsed = recipeResultSchema.safeParse(data.recipe);
      if (!parsed.success) throw new Error("Nie udało się odczytać przepisu. Spróbuj ponownie.");
      const result = parsed.data;
      if (controller.signal.aborted) throw new DOMException("Anulowano", "AbortError");
      setRecipe(result); setPhase("result");
      return { title: result.title, ingredients: result.ingredients.length, steps: result.steps.length };
    } catch (err) {
      const message = controller.signal.aborted
        ? controller.signal.reason instanceof Error && controller.signal.reason.name !== "AbortError" ? controller.signal.reason.message : "Przygotowywanie anulowane. Możesz spróbować ponownie."
        : err instanceof Error ? err.message : "Coś poszło nie tak. Spróbuj ponownie.";
      setError(message); setPhase("idle"); return { error: message };
    } finally { clearTimeout(timeout); if (requestRef.current === controller) requestRef.current = null; }
  }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { Promise.resolve(context.registerTool({
      name: "create_recipe_from_youtube", title: "Przygotuj przepis z filmu",
      description: "Generate a Polish cooking recipe from a public YouTube video and show it on the page. Sends the video URL for analysis. Uses the same action as the visible form.",
      inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input: unknown) => {
        if (!input || typeof input !== "object" || !("url" in input) || typeof input.url !== "string") return { error: "Podaj link do filmu." };
        return generate(input.url);
      },
    }, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, [generate]);
  function showExample() { if (phase === "loading") return; setRecipe(sampleRecipe); setChecked([]); setCompleted([]); setError(""); setPhase("result"); }
  function reset() { setPhase("idle"); setRecipe(null); setError(""); setUrl(""); }
  const busy = phase === "loading";
  const toggle = (list: number[], id: number) => list.includes(id) ? list.filter(n => n !== id) : [...list, id];
  return <div className="app-shell">
    <header className="site-header"><button className="brand" onClick={reset} disabled={busy} aria-label="Cooking Tube — strona główna"><span className="brand-icon"><ChefHat size={24} strokeWidth={1.8} /></span><span>cooking<span className="brand-accent">tube</span><span className="brand-dot">.</span></span></button><span className="header-note">Z filmu na Twój talerz</span></header>
    <main>
      <section className={`workspace ${phase === "result" ? "compact" : ""}`} aria-label="Przygotowanie przepisu">
        <div className="intro">
          {phase !== "result" && <><div className="eyebrow"><span className="tiny-line" /> TWOJA KUCHNIA, TWOJE TEMPO</div><h1>Obejrzyj.<br />Przygotuj.<br /><em>Smacznego.</em></h1><p className="intro-copy">Masz apetyczny film? Zamień go w przepis,<br className="desktop-br" /> z którym po prostu dobrze się gotuje.</p></>}
          <form className="link-form" onSubmit={e => { e.preventDefault(); void generate(url); }} aria-busy={busy}>
            <label htmlFor="youtube-link">{phase === "result" ? "Kolejny pomysł na coś dobrego?" : "Wklej link do filmu z YouTube"}</label>
            <div className={`input-wrapper ${error ? "has-error" : ""}`}><Link2 size={20} aria-hidden="true" /><input id="youtube-link" type="text" inputMode="url" autoComplete="off" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={e => { setUrl(e.target.value); setError(""); }} disabled={busy} aria-invalid={!!error} aria-describedby={error ? "form-error" : undefined} /></div>
            <Button className="generate-button" type="submit" disabled={busy || !url.trim()}>{busy ? <LoaderCircle className="spin" size={19} /> : <CookingPot size={20} />} {busy ? "Przygotowujemy…" : "Przygotuj przepis"}</Button>
            {error && <p id="form-error" className="form-error" role="alert"><AlertCircle size={18} /><span>{error}</span></p>}
            {!busy && phase !== "result" && <p className="form-hint">Składniki, proporcje i kroki. Wszystko w jednym miejscu.</p>}
          </form>
        </div>
        {phase === "idle" && <div className="inspiration"><div className="photo-frame"><img src="/pasta.jpg" alt="Makaron z cytryną, bazylią i parmezanem na białym talerzu" width="1448" height="1086" fetchPriority="high" /><div className="photo-label"><Leaf size={15} /> MAŁO SKŁADNIKÓW. DUŻO SMAKU.</div></div><button className="sample-card" onClick={showExample}><span><span className="sample-eyebrow">ZOBACZ, JAK TO WYGLĄDA</span><strong>Makaron cytrynowy</strong><span className="sample-meta">Przykładowy przepis · 20 min · 2 porcje</span></span><span className="sample-play"><Play size={21} fill="currentColor" /></span></button><span className="photo-caption">Trochę inspiracji na dzisiejszy obiad.</span></div>}
        {busy && <section className="loading-panel" aria-label="Przygotowywanie przepisu">
          <div className="loading-ring"><CookingPot size={42} strokeWidth={1.4} /></div>
          <span className="eyebrow">CHWILA DLA CIEBIE</span>
          <div role="status" aria-live="polite" aria-atomic="true">
            <h2>Przepis się robi.</h2>
            <p className="loading-description">Sprawdzamy Twój film i układamy składniki oraz instrukcje. Ty możesz już nastawić wodę.</p>
          </div>
          <div className="loading-skeleton" aria-hidden="true"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div>
          <span className="loading-note">{elapsed > 45 ? "Jeszcze chwila. Pozostaw tę kartę otwartą." : "Dłuższy film może potrzebować więcej czasu."}</span>
          <Button type="button" variant="ghost" className="cancel-button" onClick={() => requestRef.current?.abort()}>Anuluj przygotowanie</Button>
        </section>}

      </section>
      {phase === "result" && recipe && <section ref={resultRef} tabIndex={-1} className="recipe-sheet" aria-label={`Przepis: ${recipe.title}`}>
        <div className="recipe-topline"><span className="eyebrow"><Check size={16} /> {recipe.example ? "PRZYKŁADOWY PRZEPIS" : "GOTOWE DO GOTOWANIA"}</span><Button variant="ghost" onClick={reset} className="reset-button"><RotateCcw size={15} /> Nowy przepis</Button></div>
        <div className="recipe-heading"><div><h1>{recipe.title}</h1><p>{recipe.description}</p><div className="recipe-meta">{recipe.time && <span><Clock3 size={17} />{recipe.time}</span>}{recipe.servings && <span><Users size={17} />{recipe.servings}</span>}{recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noreferrer"><SquarePlay size={18} />{recipe.author || "Obejrzyj film"}</a>}</div></div>{recipe.example && <img className="recipe-thumbnail" src="/pasta.jpg" alt="Makaron cytrynowy — ilustracja przepisu" width="220" height="165" />}</div>
        <div className="recipe-body"><aside className="ingredients"><div className="section-title"><h2>Składniki</h2><span>{checked.length}/{recipe.ingredients.length}</span></div><p className="section-hint">Odhacz to, co masz pod ręką.</p><ul>{recipe.ingredients.map((ingredient, i) => <li key={i} className={checked.includes(i) ? "checked" : ""}><Checkbox id={`ingredient-${i}`} checked={checked.includes(i)} onCheckedChange={() => setChecked(toggle(checked, i))} /><label htmlFor={`ingredient-${i}`}><span>{ingredient.name}</span><strong>{ingredient.amount || "nie podano ilości"}</strong></label></li>)}</ul><div className="ingredient-bottom"><ChefHat size={19} /><span>Wszystko gotowe?<br /><strong>Czas na gotowanie.</strong></span></div></aside><div className="instructions"><div className="section-title"><h2>Przygotowanie</h2><span>{recipe.steps.length} {recipe.steps.length === 1 ? "krok" : recipe.steps.length % 10 >= 2 && recipe.steps.length % 10 <= 4 && !(recipe.steps.length % 100 >= 12 && recipe.steps.length % 100 <= 14) ? "kroki" : "kroków"}</span></div><ol>{recipe.steps.map((step, i) => <li key={i} className={completed.includes(i) ? "completed" : ""}><button className="step-number" onClick={() => setCompleted(toggle(completed, i))} aria-label={`${completed.includes(i) ? "Cofnij wykonanie" : "Oznacz jako wykonany"} kroku ${i + 1}`} aria-pressed={completed.includes(i)}>{completed.includes(i) ? <Check size={19} /> : String(i + 1).padStart(2, "0")}</button><div><h3>{step.title}</h3><p>{step.description}</p>{step.at !== null && recipe.sourceUrl && <a className="timestamp" href={`${recipe.sourceUrl}&t=${Math.floor(step.at)}s`} target="_blank" rel="noreferrer"><Play size={12} fill="currentColor" /> {Math.floor(step.at / 60)}:{String(Math.floor(step.at % 60)).padStart(2, "0")} w filmie</a>}</div></li>)}</ol>{completed.length === recipe.steps.length && <div className="finished"><Check size={20} /> Gotowe. Smacznego!</div>}</div></div>
        {recipe.notes.length > 0 && <div className="recipe-notes"><AlertCircle size={20} /><div><strong>Warto wiedzieć</strong>{recipe.notes.map((note, i) => <p key={i}>{note}</p>)}</div></div>}
      </section>}
      {phase === "idle" && <section className="how-it-works" aria-label="Jak to działa"><div><span>01</span><p>Znajdź coś pysznego<strong>Wybierz film z przepisem.</strong></p></div><div><span>02</span><p>Wklej link<strong>Daj nam chwilę na przygotowanie.</strong></p></div><div><span>03</span><p>Gotuj po swojemu<strong>Wszystkie kroki masz pod ręką.</strong></p></div></section>}
    </main><footer><span>cooking<strong>tube.</strong></span><span>Z przyjemnością do gotowania.</span></footer>
  </div>;
}
