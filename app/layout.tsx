import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app/app-shell";
import { serverDictionary, serverLocale } from "@/lib/locale-server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serverDictionary();
  return {
    // Absolute URLs for link previews: SITE_URL in production, Vercel's production domain, or the local server.
    metadataBase: new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:5173")),
    title: { default: t.htmlTitle, template: "%s · CookingTube" },
    description: t.description,
    applicationName: "CookingTube",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/icons/app-180.png" },
    appleWebApp: { capable: true, title: "CookingTube", statusBarStyle: "black-translucent" },
    openGraph: { type: "website", siteName: "CookingTube", title: t.htmlTitle, description: t.description, images: [{ url: "/images/og.jpg", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: t.htmlTitle, description: t.description, images: ["/images/og.jpg"] },
  };
}
export const viewport: Viewport = { themeColor: "#0a0f0b", colorScheme: "dark", viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await serverLocale();
  return <html lang={locale}>
    <head>
      <link rel="preload" href="/fonts/onest-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/fonts/bricolage-grotesque-latin-opsz-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
    </head>
    <body><AppShell locale={locale}>{children}</AppShell></body>
  </html>;
}
