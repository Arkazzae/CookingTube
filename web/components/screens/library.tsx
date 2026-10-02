"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useHydrated, useLibrary } from "@/lib/local-library";
import { count } from "@/lib/plural";
import { useGeneration } from "@/components/app/generation";
import { RecipeCard } from "@/components/app/recipe-card";
import { EmptyState } from "@/components/app/empty-state";

type Filter = "all" | "cooked" | "new";
const recipeForms: [string, string, string] = ["przepis", "przepisy", "przepisów"];
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").toLowerCase();

export function LibraryScreen({ favorites = false }: { favorites?: boolean }) {
  const library = useLibrary();
  const hydrated = useHydrated();
  const { openSheet } = useGeneration();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const base = favorites ? library.recipes.filter(r => r.favorite) : library.recipes;
  const q = normalize(query.trim());
  const shown = base.filter(item => (filter === "all" || (filter === "cooked" ? item.cookedAt : !item.cookedAt))
    && (!q || normalize([item.recipe.title, item.recipe.description, ...item.recipe.ingredients.map(i => i.name)].join(" ")).includes(q)));

  const title = favorites ? "Ulubione" : "Twoje przepisy";
  return <div className="page">
    <header className="page-head">
      <div>
        <span className="eyebrow">{favorites ? "Te, do których wracasz" : "Biblioteka na tym urządzeniu"}</span>
        <h1>{title}</h1>
        {hydrated && base.length > 0 && <p className="muted">{count(base.length, recipeForms)}</p>}
      </div>
      {!favorites && <button className="btn btn-primary page-head-action" onClick={() => openSheet()}><Plus size={18} /> Nowy przepis</button>}
    </header>

    {!hydrated ? <div className="grid">{[0, 1, 2].map(i => <div key={i} className="skeleton-card" />)}</div>
      : base.length === 0 ? (favorites
        ? <EmptyState image="empty-favorites" title="Jeszcze nic tu nie ma" action={<Link className="btn btn-secondary" href="/przepisy">Przejrzyj przepisy</Link>}>Dotknij serca przy przepisie, który chcesz mieć pod ręką. Pojawi się tutaj.</EmptyState>
        : <EmptyState image="empty-library" title="Twoja deska jest pusta" action={<button className="btn btn-primary" onClick={() => openSheet()}><Plus size={18} /> Przygotuj pierwszy przepis</button>}>Wklej link do filmu z YouTube, a przepis zapisze się tutaj — razem z Twoimi postępami.</EmptyState>)
      : <>
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Szukaj w przepisach</span>
            <input type="search" placeholder="Szukaj po nazwie lub składniku…" value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery("")} aria-label="Wyczyść wyszukiwanie"><X size={16} /></button>}
          </label>
          <div className="segmented" role="group" aria-label="Filtr">
            {([["all", "Wszystkie"], ["new", "Do ugotowania"], ["cooked", "Ugotowane"]] as const).map(([key, label]) =>
              <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
        </div>
        {shown.length ? <div className="grid">{shown.map((item, i) => <RecipeCard key={item.id} item={item} priority={i < 3} removable={!favorites} />)}</div>
          : <p className="no-results">Nic nie pasuje do „{query || "tego filtra"}”. Spróbuj innej nazwy lub składnika.</p>}
      </>}
  </div>;
}
