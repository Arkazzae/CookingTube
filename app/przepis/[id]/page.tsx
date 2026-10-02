import type { Metadata } from "next";
import { RecipeScreen } from "@/components/screens/recipe";
import { serverDictionary, serverLocale } from "@/lib/locale-server";
import { findPopular } from "@/lib/popular";
import { recipeCover } from "@/lib/recipe-cover";

// Popular recipes are known on the server, so their links get a real title, description and cover in previews.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, t, locale] = await Promise.all([params, serverDictionary(), serverLocale()]);
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
