import type { Metadata } from "next";
import { LibraryScreen } from "@/components/screens/library";
import { serverDictionary } from "@/lib/locale-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverDictionary()).meta.favorites };
}
export default function Page() {
  return <LibraryScreen favorites />;
}
