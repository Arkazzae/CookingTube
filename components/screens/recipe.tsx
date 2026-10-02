"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChefHat, Clock3, ExternalLink, Languages, ListChecks, ListOrdered, Share2, ShoppingBasket, Sparkles, Timer, Trash2, Users } from "lucide-react";
import { addToShopping, findRecipe, progressOf, saveRecipe, setProgress, useHydrated, useLibrary, type RecipeEntry } from "@/lib/local-library";
import { findTimers } from "@/lib/step-timers";
import { findPopular } from "@/lib/popular";
import { recipeResultSchema, type Recipe } from "@/lib/recipe";
import { IngredientIcon, RecipeImage, VideoThumb } from "@/components/app/media";
import { deleteWithUndo, FavoriteButton } from "@/components/app/recipe-card";
import { useGeneration } from "@/components/app/generation";
import { EmptyState } from "@/components/app/empty-state";
import { WatchPlayer, WatchProvider, WatchSteps } from "@/components/app/watch-along";
import { ShareSheet } from "@/components/app/share-sheet";
import { useLocale, useT } from "@/components/app/locale";
import { useTimerCenter } from "@/components/app/timers";
import { RecipeVotes } from "@/components/recipe-votes";

type Tab = "skladniki" | "kroki" | "uwagi";
const toggle = (list: number[], i: number) => list.includes(i) ? list.filter(n => n !== i) : [...list, i];
export const videoIdOf = (recipe: Recipe) => recipe.sourceUrl?.match(/v=([\w-]{11})/)?.[1] ?? null;

export function goBack(router: ReturnType<typeof useRouter>, fallback = "/") {
  if (window.history.length > 1) router.back(); else router.push(fallback);
}

export function RecipeScreen({ id }: { id: string }) {
  const t = useT();
  const { locale } = useLocale();
  const library = useLibrary();
  const hydrated = useHydrated();
  const item = findRecipe(library, id, locale);
  if (!hydrated) return <div className="page page-recipe"><div className="recipe-skeleton" aria-busy="true" aria-label={t.recipe.loading} /></div>;
  if (!item) return <MissingRecipe id={id} />;
  return <RecipeView item={item} />;
}

function MissingRecipe({ id }: { id: string }) {
  const t = useT();
  const { locale } = useLocale();
  const { start } = useGeneration();
  const valid = /^[\w-]{11}$/.test(id);
  const [checking, setChecking] = useState(valid);
  // A shared link may point to a recipe in the shared library; reuse it before spending another AI request.
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    fetch(`/api/library?id=${id}&lang=${locale}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ recipe?: unknown }> : null)
      .then(data => {
        const parsed = recipeResultSchema.safeParse(data?.recipe);
        if (parsed.success) saveRecipe(id, parsed.data); else setChecking(false);
      })
      .catch(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [id, locale, valid]);
  if (checking) return <div className="page page-recipe"><div className="recipe-skeleton" aria-busy="true" aria-label={t.recipe.loading} /></div>;
  return <div className="page page-narrow">
    {valid ? <section className="missing">
      <div className="missing-thumb"><VideoThumb id={id} alt="" priority /></div>
      <span className="eyebrow">{t.recipe.missingEyebrow}</span>
      <h1>{t.recipe.missingTitle}</h1>
      <p>{t.recipe.missingText}</p>
      <div className="row-actions">
        <button className="btn btn-primary" onClick={() => void start(`https://www.youtube.com/watch?v=${id}`)}><Sparkles size={18} /> {t.recipe.prepare}</button>
        <Link className="btn btn-secondary" href="/">{t.recipe.home}</Link>
      </div>
    </section> : <EmptyState image="empty-library" title={t.recipe.notFoundTitle} action={<Link className="btn btn-primary" href="/przepisy">{t.recipe.yourRecipes}</Link>}>
      {t.recipe.notFoundText}
    </EmptyState>}
  </div>;
}

function RecipeView({ item }: { item: RecipeEntry }) {
  const videoId = videoIdOf(item.recipe);
  return videoId ? <WatchProvider videoId={videoId} recipe={item.recipe}><RecipeBody item={item} videoId={videoId} /></WatchProvider> : <RecipeBody item={item} videoId={null} />;
}

function RecipeBody({ item, videoId }: { item: RecipeEntry; videoId: string | null }) {
  const t = useT();
  const { locale } = useLocale();
  const { recipe, id } = item;
  const router = useRouter();
  const library = useLibrary();
  const { open: openTimer } = useTimerCenter();
  const { have, done } = progressOf(library, id);
  const [tab, setTab] = useState<Tab>("skladniki");
  const [sharing, setSharing] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const popular = findPopular(id);
  const otherLanguage = recipe.language && recipe.language !== locale;
  const missing = recipe.ingredients.filter((_, i) => !have.includes(i));
  const timers = useMemo(() => recipe.steps.map(step => findTimers(`${step.title}. ${step.description}`)), [recipe.steps]);
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "skladniki", label: t.recipe.ingredients, badge: recipe.ingredients.length },
    { key: "kroki", label: t.recipe.steps, badge: recipe.steps.length },
    { key: "uwagi", label: t.recipe.notes, badge: recipe.notes.length || undefined },
  ];
  const stats = [
    recipe.time && { icon: Clock3, label: t.recipe.time, value: recipe.time },
    recipe.servings && { icon: Users, label: t.recipe.servings, value: recipe.servings },
    { icon: ListChecks, label: t.recipe.ingredients, value: String(recipe.ingredients.length) },
    { icon: ListOrdered, label: t.recipe.steps, value: String(recipe.steps.length) },
  ].filter(Boolean) as { icon: typeof Clock3; label: string; value: string }[];

  function addMissing() {
    if (!missing.length) return toast(t.recipe.allHave);
    const added = addToShopping(missing, { id, title: recipe.title });
    toast(added ? t.recipe.added(added) : t.recipe.onList, { action: { label: t.recipe.see, onClick: () => router.push("/zakupy") } });
  }
  function onTabKey(e: React.KeyboardEvent) {
    const index = tabs.findIndex(x => x.key === tab);
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
        <div className="recipe-topbar">
          <button className="icon-btn icon-btn--surface" onClick={() => goBack(router)} aria-label={t.recipe.back}><ArrowLeft size={20} /></button>
          <div className="recipe-hero-actions">
            <button className="icon-btn icon-btn--surface" onClick={() => setSharing(true)} aria-label={t.recipe.share}><Share2 size={18} /></button>
            <button className="icon-btn icon-btn--surface" onClick={openTimer} aria-label={t.timer.open}><Timer size={18} /></button>
            <FavoriteButton item={item} className="icon-btn icon-btn--surface" />
          </div>
        </div>
        {videoId ? <WatchPlayer recipe={recipe} /> : <div className="recipe-hero"><RecipeImage id={id} recipe={recipe} priority sizes="(min-width: 1024px) 460px, 100vw" /></div>}
        <div className="recipe-intro">
          {(recipe.author || popular || recipe.time) && <p className="recipe-source">{recipe.time && <span className="chip chip--accent"><Clock3 size={13} />{recipe.time}</span>}{popular && <span className="badge badge--gold">{t.recipe.popular}</span>}{recipe.author && <span>{t.recipe.fromVideo} <b>{recipe.author}</b></span>}</p>}
          <h1>{recipe.title}</h1>
          {recipe.description && <p>{recipe.description}</p>}
          {otherLanguage && <p className="language-note"><Languages size={16} /> {t.recipe.languageNote}</p>}
          <dl className="stats">{stats.map(({ icon: Icon, label, value }) => <div key={label}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className="recipe-cta">
            <Link href={`/przepis/${id}/gotuj`} className="btn btn-primary btn-xl">{t.recipe.start} <ArrowRight size={20} /></Link>
          </div>
        </div>
      </aside>

      <section className="recipe-main" aria-label={t.recipe.details}>
        <div className="tabs" role="tablist" aria-label={t.recipe.sections} ref={tabsRef} onKeyDown={onTabKey}>
          {tabs.map(x => <button key={x.key} role="tab" id={`tab-${x.key}`} data-tab={x.key} aria-selected={tab === x.key} aria-controls={`panel-${x.key}`}
            tabIndex={tab === x.key ? 0 : -1} className="tab-btn" onClick={() => setTab(x.key)}>{x.label}{x.badge ? <span>{x.badge}</span> : null}</button>)}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel" key={tab}>
          {tab === "skladniki" && <>
            <div className="panel-head">
              <p><b>{t.recipe.have(have.length, recipe.ingredients.length)}</b> <span className="muted">{t.recipe.tick}</span></p>
              <div className="meter" aria-hidden="true"><span style={{ width: `${(have.length / recipe.ingredients.length) * 100}%` }} /></div>
            </div>
            <ul className="ingredients">
              {recipe.ingredients.map((ingredient, i) => <li key={i}>
                <button className={`ingredient ${have.includes(i) ? "is-checked" : ""}`} aria-pressed={have.includes(i)} onClick={() => setProgress(id, { have: toggle(have, i) })}>
                  <span className="ingredient-icon">{have.includes(i) ? <Check size={18} strokeWidth={2.6} /> : <IngredientIcon name={ingredient.name} size={22} />}</span>
                  <span className="ingredient-name">{ingredient.name}</span>
                  <span className={`ingredient-amount ${ingredient.amount ? "" : "is-empty"}`}>{ingredient.amount ?? t.recipe.noAmount}</span>
                </button>
              </li>)}
            </ul>
            <button className="btn btn-secondary btn-block" onClick={addMissing} disabled={!missing.length}>
              <ShoppingBasket size={18} />{missing.length ? t.recipe.addMissing(missing.length) : t.recipe.haveAll}
            </button>
          </>}

          {tab === "kroki" && (videoId
            ? <WatchSteps recipe={recipe} done={done} timers={timers} onToggleDone={i => setProgress(id, { done: toggle(done, i) })} />
            : <ol className="steps">
              {recipe.steps.map((step, i) => <li key={i} className={done.includes(i) ? "is-done" : ""}>
                <button className="step-check" onClick={() => setProgress(id, { done: toggle(done, i) })} aria-pressed={done.includes(i)} aria-label={t.recipe.stepCheck(done.includes(i), i + 1)}>
                  {done.includes(i) ? <Check size={18} strokeWidth={2.6} /> : i + 1}
                </button>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {timers[i].length > 0 && <div className="step-timers">{timers[i].map(x => <span key={x.seconds} className="chip chip--outline"><Clock3 size={13} />{x.label}</span>)}</div>}
                </div>
              </li>)}
            </ol>)}
          {tab === "kroki" && done.length === recipe.steps.length && <p className="steps-done"><ChefHat size={22} /> {t.recipe.allDone}</p>}

          {tab === "uwagi" && <div className="notes">
            {recipe.notes.map((note, i) => <div className="note" key={i}><AlertCircle size={19} /><p>{note}</p></div>)}
            <div className="note note--info"><Sparkles size={19} /><p>{t.recipe.aiNote(recipe.author)}</p></div>
            {!item.saved && <div className="note"><Sparkles size={19} /><p>{t.recipe.popularNote}</p></div>}
            {recipe.sourceUrl && <a className="source-link" href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> {t.recipe.openOnYoutube}</a>}
            {item.saved && !popular && <RecipeVotes id={id} language={recipe.language} />}
            {item.saved && <button className="btn btn-ghost btn-danger" onClick={() => { deleteWithUndo(item, t); router.push("/przepisy"); }}><Trash2 size={17} /> {t.recipe.delete}</button>}
          </div>}
        </div>
      </section>
    </div>
    <ShareSheet open={sharing} onClose={() => setSharing(false)} id={id} recipe={recipe} />
  </div>;
}
