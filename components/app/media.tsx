"use client";
import { useState } from "react";
import { ingredientIconIndex, ingredientIcons } from "@/lib/ingredient-icons";
import { recipeCover } from "@/lib/recipe-cover";
import type { Recipe } from "@/lib/recipe";

// maxresdefault is missing for many videos; YouTube then serves a 120×90 placeholder with a 404
// that browsers still render, so check the decoded size as well as the error event.
const thumbs = ["maxresdefault", "hq720", "sddefault", "hqdefault"] as const;
export type ThumbVariant = typeof thumbs[number];

export function VideoThumb({ id, alt = "", className = "", priority = false, variant = "maxresdefault" }: { id: string; alt?: string; className?: string; priority?: boolean; variant?: ThumbVariant }) {
  const first = thumbs.indexOf(variant);
  const [attempt, setAttempt] = useState({ id, index: first });
  const index = attempt.id === id ? attempt.index : first;
  const last = thumbs.length - 1;
  const next = () => setAttempt({ id, index: Math.min(index + 1, last) });
  return <img
    key={`${id}-${index}`}
    // sddefault and hqdefault are 4:3 frames with letterbox bars around a 16:9 picture.
    className={`media-img ${index >= 2 ? "is-letterboxed" : ""} ${className}`}
    src={`https://i.ytimg.com/vi/${id}/${thumbs[index]}.jpg`}
    alt={alt} referrerPolicy="no-referrer" decoding="async"
    loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
    onLoad={e => { if (e.currentTarget.naturalWidth <= 120 && index < last) next(); }}
    onError={() => { if (index < last) next(); }}
  />;
}

type CoverSource = Pick<Recipe, "title" | "description" | "ingredients">;
/** Recipe artwork: the dish category's cover photo, framed per recipe. */
export function RecipeImage({ id, recipe, className = "", priority, sizes = "(min-width: 1024px) 340px, 76vw" }: { id: string; recipe: CoverSource; className?: string; priority?: boolean; sizes?: string }) {
  const cover = recipeCover(recipe, id);
  const small = cover.src.replace(/\.webp$/, "-sm.webp");
  return <img className={`media-img cover-img ${className}`} src={cover.src} srcSet={`${small} 560w, ${cover.src} 1000w`} sizes={sizes} alt="" decoding="async"
    loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
    style={{ objectPosition: cover.position, "--flip": cover.mirrored ? -1 : 1 } as React.CSSProperties} />;
}

export function IngredientIcon({ name, size = 22 }: { name: string; size?: number }) {
  const index = ingredientIconIndex(name);
  const rows = ingredientIcons.length / 5;
  return <span className="sprite sprite-ingredient" aria-hidden="true" style={{ width: size, height: size, backgroundPosition: `${(index % 5) * 25}% ${(Math.floor(index / 5) / (rows - 1)) * 100}%` }} />;
}

// Cells of public/icons/categories-24.webp: 4 columns, 6 rows.
export const categoryIcons = {
  breakfast: 0, main: 1, soup: 2, vege: 3, dessert: 4, quick: 5, pasta: 6, asian: 7, bread: 8, link: 9, video: 10, chef: 11,
  grill: 12, salad: 13, seafood: 14, pizza: 15, drinks: 16, burger: 17, pancakes: 18, roast: 19, dumpling: 20, spicy: 21, budget: 22, holidays: 23,
} as const;
export type CategoryIconName = keyof typeof categoryIcons;
export function CategoryIcon({ icon, size = 28 }: { icon: CategoryIconName; size?: number }) {
  const index = categoryIcons[icon];
  return <span className="sprite sprite-category" aria-hidden="true" style={{ width: size, height: size, backgroundPosition: `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * 20}%` }} />;
}
