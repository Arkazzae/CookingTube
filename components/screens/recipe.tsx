"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChefHat, Clock3, ExternalLink, ListChecks, ListOrdered, Play, Share2, ShoppingBasket, Sparkles, Trash2, Users } from "lucide-react";
import { addToShopping, findRecipe, progressOf, setProgress, useHydrated, useLibrary, type RecipeEntry } from "@/lib/local-library";
import { findTimers } from "@/lib/step-timers";
import { findPopular } from "@/lib/popular";
import { count } from "@/lib/plural";
import type { Recipe } from "@/lib/recipe";
import { IngredientIcon, RecipeImage, VideoThumb } from "@/components/app/media";
import { deleteWithUndo, FavoriteButton } from "@/components/app/recipe-card";
import { useGeneration } from "@/components/app/generation";
import { EmptyState } from "@/components/app/empty-state";
import { WatchAlong } from "@/components/app/watch-along";

type Tab = "skladniki" | "kroki" | "uwagi";
const toggle = (list: number[], i: number) => list.includes(i) ? list.filter(n => n !== i) : [...list, i];
const videoIdOf = (recipe: Recipe) => recipe.sourceUrl?.match(/v=([\w-]{11})/)?.[1] ?? null;

export function recipeAsText(recipe: Recipe) {
  return [recipe.title, recipe.description, "", "Składniki:", ...recipe.ingredients.map(i => `• ${i.name}${i.amount ? ` — ${i.amount}` : ""}`), "",
    "Przygotowanie:", ...recipe.steps.map((s, n) => `${n + 1}. ${s.title}. ${s.description}`), ...(recipe.sourceUrl ? ["", `Film: ${recipe.sourceUrl}`] : [])].join("\n");
}

export function goBack(router: ReturnType<typeof useRouter>, fallback = "/") {
  if (window.history.length > 1) router.back(); else router.push(fallback);
}

export function RecipeScreen({ id }: { id: string }) {
  const library = useLibrary();
  const hydrated = useHydrated();
  const item = findRecipe(library, id);
  if (!hydrated) return <div className="page page-recipe"><div className="recipe-skeleton" aria-busy="true" aria-label="Wczytywanie przepisu" /></div>;
  if (!item) return <MissingRecipe id={id} />;
  return <RecipeView item={item} />;
}

function MissingRecipe({ id }: { id: string }) {
  const { start } = useGeneration();
  const valid = /^[\w-]{11}$/.test(id);
  return <div className="page page-narrow">
    {valid ? <section className="missing">
      <div className="missing-thumb"><VideoThumb id={id} alt="Miniatura filmu" priority /></div>
      <span className="eyebrow">Przepis z filmu</span>
      <h1>Tego przepisu nie ma jeszcze na tym urządzeniu</h1>
      <p>Przepisy zapisują się w przeglądarce, w której je przygotowano. Możesz przygotować go tutaj od nowa.</p>
      <div className="row-actions">
        <button className="btn btn-primary" onClick={() => void start(`https://www.youtube.com/watch?v=${id}`)}><Sparkles size={18} /> Przygotuj przepis</button>
        <Link className="btn btn-secondary" href="/">Strona główna</Link>
      </div>
    </section> : <EmptyState image="empty-library" title="Nie znaleźliśmy tego przepisu" action={<Link className="btn btn-primary" href="/przepisy">Twoje przepisy</Link>}>
      Link mógł się zmienić albo przepis został usunięty.
    </EmptyState>}
  </div>;
}

function RecipeView({ item }: { item: RecipeEntry }) {
  const { recipe, id } = item;
  const router = useRouter();
  const library = useLibrary();
  const { have, done } = progressOf(library, id);
  const [tab, setTab] = useState<Tab>("skladniki");
  const [watch, setWatch] = useState<{ at: number; nonce: number } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const videoId = videoIdOf(recipe);
  const popular = findPopular(id);
  const missing = recipe.ingredients.filter((_, i) => !have.includes(i));
  const timers = useMemo(() => recipe.steps.map(step => findTimers(`${step.title}. ${step.description}`)), [recipe.steps]);
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "skladniki", label: "Składniki", badge: recipe.ingredients.length },
    { key: "kroki", label: "Kroki", badge: recipe.steps.length },
    { key: "uwagi", label: "Uwagi", badge: recipe.notes.length || undefined },
  ];
  const stats = [
    recipe.time && { icon: Clock3, label: "Czas", value: recipe.time },
    recipe.servings && { icon: Users, label: "Porcje", value: recipe.servings },
    { icon: ListChecks, label: "Składniki", value: String(recipe.ingredients.length) },
    { icon: ListOrdered, label: "Kroki", value: String(recipe.steps.length) },
  ].filter(Boolean) as { icon: typeof Clock3; label: string; value: string }[];

  function addMissing() {
    const added = addToShopping(missing, { id, title: recipe.title });
    if (!missing.length) return toast("Masz już wszystkie składniki");
    toast(added ? `Dodano ${count(added, ["produkt", "produkty", "produktów"])} do listy zakupów` : "Te produkty są już na liście zakupów",
      { action: { label: "Zobacz", onClick: () => router.push("/zakupy") } });
  }
  async function share() {
    const text = recipeAsText(recipe);
    try {
      if (navigator.share) return await navigator.share({ title: recipe.title, text });
      await navigator.clipboard.writeText(text); toast("Skopiowano przepis do schowka");
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast("Nie udało się udostępnić przepisu"); }
  }
  function onTabKey(e: React.KeyboardEvent) {
    const index = tabs.findIndex(t => t.key === tab);
    const next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = tabs[(next + tabs.length) % tabs.length].key;
    setTab(target);
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${target}"]`)?.focus();
  }

  return <div className="page page-recipe">
    <div className="recipe-layout">
      <aside className="recipe-aside">
        <div className="recipe-hero">
          <RecipeImage id={id} recipe={recipe} priority sizes="(min-width: 1024px) 460px, 100vw" />
          <div className="recipe-hero-bar">
            <button className="icon-btn icon-btn--glass" onClick={() => goBack(router)} aria-label="Wróć"><ArrowLeft size={20} /></button>
            <div className="recipe-hero-actions">
              {item.saved && <button className="icon-btn icon-btn--glass" onClick={() => { deleteWithUndo(item); router.push("/przepisy"); }} aria-label="Usuń przepis z urządzenia"><Trash2 size={18} /></button>}
              <FavoriteButton item={item} className="icon-btn icon-btn--glass" />
            </div>
          </div>
          <div className="recipe-hero-foot">
            {recipe.time && <span className="chip chip--accent chip--lg"><Clock3 size={14} />{recipe.time}</span>}
            {videoId && <button className="chip chip--glass" onClick={() => { setTab("kroki"); setWatch({ at: 0, nonce: Date.now() }); }}><Play size={13} fill="currentColor" /> Oglądaj i gotuj</button>}
          </div>
        </div>
        <div className="recipe-intro">
          {(recipe.author || popular) && <p className="recipe-source">{popular && <span className="badge badge--gold">Popularne</span>}{recipe.author && <span>z filmu: <b>{recipe.author}</b></span>}</p>}
          <h1>{recipe.title}</h1>
          {recipe.description && <p>{recipe.description}</p>}
          <dl className="stats">{stats.map(({ icon: Icon, label, value }) => <div key={label}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className="recipe-cta">
            <Link href={`/przepis/${id}/gotuj`} className="btn btn-primary btn-xl">Zacznij gotować <ArrowRight size={20} /></Link>
            <button className="icon-btn icon-btn--outline" onClick={() => void share()} aria-label="Udostępnij przepis"><Share2 size={20} /></button>
          </div>
        </div>
      </aside>

      <section className="recipe-main" aria-label="Szczegóły przepisu">
        <div className="tabs" role="tablist" aria-label="Sekcje przepisu" ref={tabsRef} onKeyDown={onTabKey}>
          {tabs.map(t => <button key={t.key} role="tab" id={`tab-${t.key}`} data-tab={t.key} aria-selected={tab === t.key} aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1} className="tab-btn" onClick={() => setTab(t.key)}>{t.label}{t.badge ? <span>{t.badge}</span> : null}</button>)}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel" key={tab}>
          {tab === "skladniki" && <>
            <div className="panel-head">
              <p><b>{have.length}</b> z {recipe.ingredients.length} w kuchni <span className="muted">· odhacz to, co masz</span></p>
              <div className="meter" aria-hidden="true"><span style={{ width: `${(have.length / recipe.ingredients.length) * 100}%` }} /></div>
            </div>
            <ul className="ingredients">
              {recipe.ingredients.map((ingredient, i) => <li key={i}>
                <button className={`ingredient ${have.includes(i) ? "is-checked" : ""}`} aria-pressed={have.includes(i)} onClick={() => setProgress(id, { have: toggle(have, i) })}>
                  <span className="ingredient-icon">{have.includes(i) ? <Check size={18} strokeWidth={2.6} /> : <IngredientIcon name={ingredient.name} size={22} />}</span>
                  <span className="ingredient-name">{ingredient.name}</span>
                  <span className={`ingredient-amount ${ingredient.amount ? "" : "is-empty"}`}>{ingredient.amount ?? "bez ilości"}</span>
                </button>
              </li>)}
            </ul>
            <button className="btn btn-secondary btn-block" onClick={addMissing} disabled={!missing.length}>
              <ShoppingBasket size={18} />{missing.length ? `Dodaj brakujące (${missing.length}) do zakupów` : "Masz wszystko — można gotować"}
            </button>
          </>}

          {tab === "kroki" && (videoId
            ? <WatchAlong recipe={recipe} videoId={videoId} done={done} timers={timers} request={watch} onToggleDone={i => setProgress(id, { done: toggle(done, i) })} />
            : <ol className="steps">
              {recipe.steps.map((step, i) => <li key={i} className={done.includes(i) ? "is-done" : ""}>
                <button className="step-check" onClick={() => setProgress(id, { done: toggle(done, i) })} aria-pressed={done.includes(i)} aria-label={`${done.includes(i) ? "Cofnij wykonanie" : "Oznacz jako wykonany"}: krok ${i + 1}`}>
                  {done.includes(i) ? <Check size={18} strokeWidth={2.6} /> : i + 1}
                </button>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {timers[i].length > 0 && <div className="step-timers">{timers[i].map(t => <span key={t.seconds} className="chip chip--outline"><Clock3 size={13} />{t.label}</span>)}</div>}
                </div>
              </li>)}
            </ol>)}
          {tab === "kroki" && done.length === recipe.steps.length && <p className="steps-done"><ChefHat size={22} /> Wszystkie kroki zrobione. Smacznego!</p>}

          {tab === "uwagi" && <div className="notes">
            {recipe.notes.map((note, i) => <div className="note" key={i}><AlertCircle size={19} /><p>{note}</p></div>)}
            <div className="note note--info"><Sparkles size={19} /><p>Przepis przygotowała sztuczna inteligencja na podstawie obrazu i dźwięku filmu{recipe.author ? ` „${recipe.author}”` : ""}. Ilości, których autor nie podał wprost, zostały puste, a momenty kroków w filmie są przybliżone. Jeśli coś budzi wątpliwości, zajrzyj do filmu.</p></div>
            {!item.saved && <div className="note"><Sparkles size={19} /><p>To jeden z popularnych przepisów. Dotknij serca, aby zapisać go na tym urządzeniu — postępy i lista zakupów działają także bez zapisywania.</p></div>}
            {recipe.sourceUrl && <a className="source-link" href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Otwórz film na YouTube</a>}
          </div>}

        </div>
      </section>
    </div>
    <div className="cta-bar">
      <Link href={`/przepis/${id}/gotuj`} className="btn btn-primary btn-xl">Zacznij gotować <ArrowRight size={20} /></Link>
      <button className="icon-btn icon-btn--outline" onClick={() => void share()} aria-label="Udostępnij przepis"><Share2 size={20} /></button>
    </div>
  </div>;
}

