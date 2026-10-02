import type { Metadata } from "next";
import { ShoppingScreen } from "@/components/screens/shopping";
import { serverDictionary } from "@/lib/locale-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverDictionary()).meta.shopping };
}
export default function Page() {
  return <ShoppingScreen />;
}
