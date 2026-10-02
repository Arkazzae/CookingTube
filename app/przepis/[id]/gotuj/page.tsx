import type { Metadata } from "next";
import { CookingScreen } from "@/components/screens/cooking";
import { serverDictionary } from "@/lib/locale-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverDictionary()).meta.cooking };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CookingScreen id={id} />;
}
