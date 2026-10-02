"use client";
import Link from "@/components/app/app-link";
import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { saveRecipe, useHydrated, useLibrary } from "@/lib/local-library";
import { useRouter } from "next/navigation";
import { useGeneration } from "@/components/app/generation";
import { RecipeCard } from "@/components/app/recipe-card";
import { EmptyState } from "@/components/app/empty-state";
import { useT } from "@/components/app/locale";
import { SharedRecipes } from "@/components/shared-recipes";

type Filter = "all" | "cooked" | "new";
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").toLowerCase();

export function LibraryScreen({ favorites = false }: { favorites?: boolean }) {
  const t = useT();
  const library = useLibrary();
  const hydrated = useHydrated();
  const { openSheet } = useGeneration();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const base = favorites ? library.recipes.filter(r => r.favorite) : library.recipes;
  const q = normalize(query.trim());
  const shown = base.filter(item => (filter === "all" || (filter === "cooked" ? item.cookedAt : !item.cookedAt))
    && (!q || normalize([item.recipe.title, item.recipe.description, ...item.recipe.ingredients.map(i => i.name)].join(" ")).includes(q)));

  const title = favorites ? t.library.favTitle : t.library.title;
  return <div className="page">
    <header className="page-head">
      <div>
        <span className="eyebrow">{favorites ? t.library.favEyebrow : t.library.eyebrow}</span>
        <h1>{title}</h1>
        {hydrated && base.length > 0 && <p className="muted">{t.count.recipes(base.length)}</p>}
      </div>
      {!favorites && <button className="btn btn-primary page-head-action" onClick={() => openSheet()}><Plus size={18} /> {t.nav.newRecipe}</button>}
    </header>

    {!hydrated ? <div className="grid">{[0, 1, 2].map(i => <div key={i} className="skeleton-card" />)}</div>
      : base.length === 0 ? (favorites
        ? <EmptyState image="empty-favorites" title={t.library.favEmptyTitle} action={<Link className="btn btn-secondary" href="/">{t.library.browse}</Link>}>{t.library.favEmptyText}</EmptyState>
        : <EmptyState image="empty-library" title={t.library.emptyTitle} action={<button className="btn btn-primary" onClick={() => openSheet()}><Plus size={18} /> {t.library.first}</button>}>{t.library.emptyText}</EmptyState>)
      : <>
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">{t.library.search}</span>
            <input type="search" placeholder={t.library.searchPlaceholder} value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery("")} aria-label={t.library.clear}><X size={16} /></button>}
          </label>
          <div className="segmented" role="group" aria-label={t.library.filter}>
            {(["all", "new", "cooked"] as const).map(key =>
              <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{t.library.filters[key]}</button>)}
          </div>
        </div>
        {shown.length ? <div className="grid">{shown.map((item, i) => <RecipeCard key={item.id} item={item} priority={i < 3} removable={!favorites} />)}</div>
          : <p className="no-results">{t.library.noResults(query)}</p>}
      </>}
    {hydrated && !favorites && <SharedRecipes onOpen={(id, recipe) => { if (!library.recipes.some(r => r.id === id)) saveRecipe(id, recipe); router.push(`/przepis/${id}`); }} />}
  </div>;
}
