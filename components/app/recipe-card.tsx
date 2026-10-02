"use client";
import Link from "next/link";
import { Clock3, Heart, ListChecks, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeRecipe, restoreRecipe, toggleFavorite, type SavedRecipe } from "@/lib/local-library";
import { recipeCover } from "@/lib/recipe-cover";
import type { Dictionary } from "@/lib/i18n";
import { RecipeImage } from "./media";
import { useT } from "./locale";

type CardItem = SavedRecipe & { saved?: boolean };

export function FavoriteButton({ item, className = "" }: { item: CardItem; className?: string }) {
  const t = useT();
  return <button className={`fav-btn ${item.favorite ? "is-on" : ""} ${className}`} aria-pressed={item.favorite}
    aria-label={item.favorite ? t.card.removeFav(item.recipe.title) : t.card.addFav(item.recipe.title)}
    onClick={() => { const on = toggleFavorite({ ...item, saved: item.saved ?? true }); toast(on ? t.card.favAdded : t.card.favRemoved); }}>
    <Heart size={18} fill={item.favorite ? "currentColor" : "none"} strokeWidth={2} />
  </button>;
}

export function deleteWithUndo(item: SavedRecipe, t: Dictionary) {
  const removed = removeRecipe(item.id);
  if (removed) toast(t.card.removed(removed.recipe.title), { action: { label: t.card.undo, onClick: () => restoreRecipe(removed) } });
}

export function RecipeCard({ item, variant = "tile", priority = false, removable = false }: { item: CardItem; variant?: "feature" | "tile"; priority?: boolean; removable?: boolean }) {
  const t = useT();
  const { recipe } = item;
  return <article className={`recipe-card recipe-card--${variant}`}>
    <Link href={`/przepis/${item.id}`} className="recipe-card-link">
      <div className="recipe-card-media"><RecipeImage id={item.id} recipe={recipe} priority={priority} /></div>
      <div className="recipe-card-body">
        <span className="badge badge--gold">{t.covers[recipeCover(recipe, item.id).key]}</span>
        <h3>{recipe.title}</h3>
        {recipe.author && <p className="recipe-card-author">{recipe.author}</p>}
        <div className="recipe-card-meta">
          {recipe.time ? <span className="chip chip--accent"><Clock3 size={13} />{recipe.time}</span> : <span className="chip chip--accent"><ListChecks size={13} />{t.count.ingredients(recipe.ingredients.length)}</span>}
          <span className="recipe-card-steps">{t.count.steps(recipe.steps.length)}</span>
        </div>
      </div>
    </Link>
    <FavoriteButton item={item} className="recipe-card-fav" />
    {removable && <button className="recipe-card-remove" onClick={() => deleteWithUndo(item, t)} aria-label={t.card.remove(recipe.title)}><Trash2 size={16} /></button>}
  </article>;
}
