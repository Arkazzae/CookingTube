import type { Metadata } from "next";
import { LibraryScreen } from "@/components/screens/library";

export const metadata: Metadata = { title: "Ulubione" };
export default function Page() {
  return <LibraryScreen favorites />;
}
