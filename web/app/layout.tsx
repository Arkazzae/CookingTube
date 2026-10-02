import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Cooking Tube — z filmu na talerz",
  description: "Zamień film z YouTube w czytelny przepis. Składniki, proporcje i przygotowanie krok po kroku.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}
