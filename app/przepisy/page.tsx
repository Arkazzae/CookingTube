import type { Metadata } from "next";
import { LibraryScreen } from "@/components/screens/library";

export const metadata: Metadata = { title: "Twoje przepisy" };
export default function Page() {
  return <LibraryScreen />;
}
