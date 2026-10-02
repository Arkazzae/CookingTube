"use client";
import { useRef } from "react";
import { Play } from "lucide-react";
import { YouTubePlayer, type YouTubeHandle } from "./youtube-player";
import { useAppLocale } from "@/hooks/use-app-locale";
import type { Recipe } from "@/lib/recipe";
import { parseVideoId } from "@/lib/youtube-url";
export function RecipeFilm({ recipe }: { recipe: Recipe }) {
  const player = useRef<YouTubeHandle>(null);
  const locale = useAppLocale();
  const id = recipe.sourceUrl ? parseVideoId(recipe.sourceUrl) : null;
  if (!id) return null;
  return <div>
    <YouTubePlayer key={id} ref={player} id={id} title={recipe.title} />
    <ol className="film-chapters" aria-label={locale === "pl" ? "Etapy w filmie" : "Video chapters"}>
      {recipe.steps.map((step, index) => <li key={index}>
        {step.at !== null ? <button onClick={() => player.current?.seek(step.at!)}><Play size={15} /><span>{step.title}</span><time>{Math.floor(step.at / 60)}:{String(Math.floor(step.at % 60)).padStart(2, "0")}</time></button>
          : <p><span>{step.title}</span><small>{locale === "pl" ? "Brak pewnego czasu" : "No reliable timestamp"}</small></p>}
      </li>)}
    </ol>
  </div>;
}
