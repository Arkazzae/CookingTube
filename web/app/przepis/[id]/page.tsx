import type { Metadata } from "next";
import { RecipeScreen } from "@/components/screens/recipe";

export const metadata: Metadata = { title: "Przepis" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeScreen id={id} />;
}
