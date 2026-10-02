import type { Metadata } from "next";
import { CookingScreen } from "@/components/screens/cooking";

export const metadata: Metadata = { title: "Tryb gotowania" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CookingScreen id={id} />;
}
