import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CookingTube — z filmu na talerz", template: "%s · CookingTube" },
  description: "Zamień film z YouTube w czytelny przepis. Składniki, lista zakupów i gotowanie krok po kroku.",
  applicationName: "CookingTube",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/icons/app-180.png" },
  appleWebApp: { capable: true, title: "CookingTube", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0a0f0b", colorScheme: "dark", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl">
    <head>
      <link rel="preload" href="/fonts/onest-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/fonts/bricolage-grotesque-latin-opsz-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
    </head>
    <body><AppShell>{children}</AppShell></body>
  </html>;
}
