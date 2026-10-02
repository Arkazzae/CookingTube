import type { Metadata } from "next";
import { PrintScreen } from "@/components/screens/print";
import { serverDictionary } from "@/lib/locale-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverDictionary()).meta.pdf, robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintScreen id={id} />;
}
