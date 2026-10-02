"use client";
import Link from "next/link";
import { Clock3, Heart, ListChecks, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { count } from "@/lib/plural";
import { removeRecipe, restoreRecipe, toggleFavorite, type SavedRecipe } from "@/lib/local-library";
import { recipeCover } from "@/lib/recipe-cover";
import { RecipeImage } from "./media";

export const ingredientForms: [string, string, string] = ["składnik", "składniki", "składników"];
export const stepForms: [string, string, string] = ["krok", "kroki", "kroków"];

type CardItem = SavedRecipe & { saved?: boolean };

export function FavoriteButton({ item, className = "" }: { item: CardItem; className?: string }) {
  return <button className={`fav-btn ${item.favorite ? "is-on" : ""} ${className}`} aria-pressed={item.favorite}
    aria-label={item.favorite ? `Usuń „${item.recipe.title}” z ulubionych` : `Dodaj „${item.recipe.title}” do ulubionych`}
    onClick={() => { const on = toggleFavorite({ ...item, saved: item.saved ?? true }); toast(on ? "Dodano do ulubionych" : "Usunięto z ulubionych"); }}>
    <Heart size={18} fill={item.favorite ? "currentColor" : "none"} strokeWidth={2} />
  </button>;
}

export function deleteWithUndo(item: SavedRecipe) {
  const removed = removeRecipe(item.id);
  if (removed) toast(`Usunięto „${removed.recipe.title}”`, { action: { label: "Cofnij", onClick: () => restoreRecipe(removed) } });
}

export function RecipeCard({ item, variant = "tile", priority = false, removable = false, label }: { item: CardItem; variant?: "feature" | "tile"; priority?: boolean; removable?: boolean; label?: string }) {
  const { recipe } = item;
  return <article className={`recipe-card recipe-card--${variant}`}>
    <Link href={`/przepis/${item.id}`} className="recipe-card-link">
      <div className="recipe-card-media"><RecipeImage id={item.id} recipe={recipe} priority={priority} /></div>
      <div className="recipe-card-body">
        <span className="badge badge--gold">{label ?? recipeCover(recipe, item.id).label}</span>
        <h3>{recipe.title}</h3>
        {recipe.author && <p className="recipe-card-author">{recipe.author}</p>}
        <div className="recipe-card-meta">
          {recipe.time ? <span className="chip chip--accent"><Clock3 size={13} />{recipe.time}</span> : <span className="chip chip--accent"><ListChecks size={13} />{count(recipe.ingredients.length, ingredientForms)}</span>}
          <span className="recipe-card-steps">{count(recipe.steps.length, stepForms)}</span>
        </div>
      </div>
    </Link>
    <FavoriteButton item={item} className="recipe-card-fav" />
    {removable && <button className="recipe-card-remove" onClick={() => deleteWithUndo(item)} aria-label={`Usuń „${recipe.title}”`}><Trash2 size={16} /></button>}
  </article>;
}
