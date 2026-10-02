"use client";
import Link from "@/components/app/app-link";
import { useEffect, useRef } from "react";
import { ArrowLeft, Clock3, ListChecks, ListOrdered, Printer, Users } from "lucide-react";
import { findRecipe, useHydrated, useLibrary } from "@/lib/local-library";
import { recipeCover } from "@/lib/recipe-cover";
import { formatClock } from "@/lib/step-timers";
import { IngredientIcon } from "@/components/app/media";
import { useLocale, useT } from "@/components/app/locale";
import { RecipeScreen } from "./recipe";

/** A paper version of the recipe: the browser's print dialog saves it as a PDF. */
export function PrintScreen({ id }: { id: string }) {
  const t = useT();
  const { locale } = useLocale();
  const library = useLibrary();
  const hydrated = useHydrated();
  const item = findRecipe(library, id, locale);
  const printed = useRef(false);

  useEffect(() => {
    if (!item || printed.current) return;
    printed.current = true;
    // ?preview shows the card without opening the print dialog (handy for screenshots and previews).
    if (new URLSearchParams(location.search).has("preview")) return;
    // Wait for the cover and fonts so the PDF never captures a half-loaded page.
    const cover = document.querySelector<HTMLImageElement>(".print-cover img");
    const ready = Promise.all([document.fonts.ready, cover?.decode().catch(() => {})]);
    const timer = setTimeout(() => void ready.then(() => window.print()), 400);
    return () => clearTimeout(timer);
  }, [item]);

  if (!hydrated) return null;
  if (!item) return <RecipeScreen id={id} />;
  const { recipe } = item;
  const cover = recipeCover(recipe, id);
  const pageUrl = `${location.origin}/przepis/${id}`;
  const stats = [
    recipe.time && { icon: Clock3, label: t.recipe.time, value: recipe.time },
    recipe.servings && { icon: Users, label: t.recipe.servings, value: recipe.servings },
    { icon: ListChecks, label: t.recipe.ingredients, value: String(recipe.ingredients.length) },
    { icon: ListOrdered, label: t.recipe.steps, value: String(recipe.steps.length) },
  ].filter(Boolean) as { icon: typeof Clock3; label: string; value: string }[];

  return <div className="print-page">
    <div className="print-toolbar">
      <Link href={`/przepis/${id}`} className="btn btn-ghost"><ArrowLeft size={18} /> {t.share.back}</Link>
      <p>{t.card2.printHint}</p>
      <button className="btn btn-primary" onClick={() => window.print()}><Printer size={18} /> {t.card2.print}</button>
    </div>

    <article className="paper">
      <header className="paper-head">
        <div className="paper-brand">
          <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true"><path d="M13 51C13 27 27 13 51 13c0 24-14 38-38 38Z" fill="#4f9a2d" /><path d="M28 25.5v13l11-6.5Z" fill="#fbfaf5" /></svg>
          <span>Cooking<b>Tube</b></span>
          <span className="paper-category">{t.covers[cover.key]}</span>
        </div>
        <div className="paper-intro">
          <div>
            <h1>{recipe.title}</h1>
            {recipe.author && <p className="paper-author">{t.card2.from}: <b>{recipe.author}</b></p>}
            {recipe.description && <p className="paper-description">{recipe.description}</p>}
            <dl className="paper-stats">{stats.map(({ icon: Icon, label, value }) => <div key={label}><Icon size={16} aria-hidden="true" /><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </div>
          <div className="print-cover"><img src={cover.src} alt="" style={{ objectPosition: cover.position, transform: cover.mirrored ? "scaleX(-1)" : undefined }} /></div>
        </div>
      </header>

      <div className="paper-body">
        <section className="paper-ingredients">
          <h2>{t.card2.ingredients}</h2>
          <ul>{recipe.ingredients.map((ingredient, i) => <li key={i}>
            <span className="paper-box" aria-hidden="true" />
            <IngredientIcon name={ingredient.name} size={18} />
            <span className="paper-name">{ingredient.name}</span>
            {ingredient.amount && <span className="paper-amount">{ingredient.amount}</span>}
          </li>)}</ul>
        </section>
        <section className="paper-steps">
          <h2>{t.card2.steps}</h2>
          <ol>{recipe.steps.map((step, i) => <li key={i}>
            <span className="paper-num">{i + 1}</span>
            <div><h3>{step.title}{step.at !== null && <span className="paper-time">▶ {formatClock(step.at)}</span>}</h3><p>{step.description}</p></div>
          </li>)}</ol>
        </section>
      </div>

      <footer className="paper-foot">
        <span>{t.card2.made} · {pageUrl.replace(/^https?:\/\//, "")}</span>
        {recipe.sourceUrl && <span>{t.card2.source}: {recipe.sourceUrl.replace(/^https?:\/\//, "")}</span>}
      </footer>
    </article>
  </div>;
}
