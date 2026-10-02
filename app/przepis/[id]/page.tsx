import type { Metadata } from "next";
import { RecipeScreen } from "@/components/screens/recipe";
import { serverLocale } from "@/lib/locale-server";
import { dictionaries } from "@/lib/i18n";
import { findPopular } from "@/lib/popular";
import { recipeCover } from "@/lib/recipe-cover";

// Popular recipes are known on the server, so their links get a real title, description and cover in previews.
// Shared links carry ?lang= so crawlers, which rarely send the sharer's language, preview it in that language.
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const [{ id }, { lang }, browserLocale] = await Promise.all([params, searchParams, serverLocale()]);
  const locale = lang === "pl" || lang === "en" ? lang : browserLocale;
  const t = dictionaries[locale];
  const popular = findPopular(id);
  if (!popular) return { title: t.meta.recipe };
  const recipe = (locale === "en" && popular.translations?.en) || popular.recipe;
  const image = recipeCover(recipe, id).src;
  return {
    title: recipe.title, description: recipe.description,
    openGraph: { type: "article", title: recipe.title, description: recipe.description, images: [{ url: image, width: 1000 }] },
    twitter: { card: "summary_large_image", title: recipe.title, description: recipe.description, images: [image] },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeScreen id={id} />;
}
