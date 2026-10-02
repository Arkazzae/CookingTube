import type { Metadata } from "next";
import { ShoppingScreen } from "@/components/screens/shopping";

export const metadata: Metadata = { title: "Lista zakupów" };
export default function Page() {
  return <ShoppingScreen />;
}
