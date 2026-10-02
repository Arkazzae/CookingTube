"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Heart, House, Plus, ShoppingBasket } from "lucide-react";
import { Toaster } from "sonner";
import { useHydrated, useLibrary } from "@/lib/local-library";
import { GenerationProvider, useGeneration } from "./generation";
import { GenerationOverlay } from "./generation-overlay";
import { LinkForm } from "./link-form";
import { Sheet } from "./sheet";
import { Wordmark } from "./brand";

const nav = [
  { href: "/", label: "Start", icon: House },
  { href: "/przepisy", label: "Przepisy", icon: BookOpen },
  { href: "/ulubione", label: "Ulubione", icon: Heart },
  { href: "/zakupy", label: "Zakupy", icon: ShoppingBasket },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return <GenerationProvider><Shell>{children}</Shell></GenerationProvider>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.endsWith("/gotuj");
  // Recipe pages add a floating "start cooking" bar above the tab bar on phones.
  const detail = pathname.startsWith("/przepis/");
  const { sheetOpen, closeSheet, draft } = useGeneration();
  return <div className={`shell ${immersive ? "shell--immersive" : ""} ${detail ? "shell--detail" : ""}`}>
    <a href="#tresc" className="skip-link">Przejdź do treści</a>
    {!immersive && <Sidebar pathname={pathname} />}
    <main id="tresc" className="shell-main">{children}</main>
    {!immersive && <BottomNav pathname={pathname} />}
    <GenerationOverlay />
    <Sheet open={sheetOpen} onClose={closeSheet} title="Nowy przepis z filmu" description="Wklej link do publicznego filmu z YouTube — także Shorts.">
      <LinkForm variant="sheet" initial={draft} autoFocus />
      <ul className="sheet-tips">
        <li>Najlepiej działają filmy z jednym przepisem, w których widać składniki i przygotowanie.</li>
        <li>Przepis zapisze się w Twojej bibliotece na tym urządzeniu.</li>
      </ul>
    </Sheet>
    <Toaster theme="dark" position="top-center" offset={16} mobileOffset={12} toastOptions={{ className: "toast" }}
      style={{ "--normal-bg": "#1d2820", "--normal-border": "rgba(214,255,220,.12)", "--normal-text": "#eef3ea", "--border-radius": "16px" } as React.CSSProperties} />
  </div>;
}

const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

function useCounts() {
  const library = useLibrary();
  const hydrated = useHydrated();
  if (!hydrated) return {} as Record<string, number>;
  return { "/przepisy": library.recipes.length, "/ulubione": library.recipes.filter(r => r.favorite).length, "/zakupy": library.shopping.filter(s => !s.checked).length } as Record<string, number>;
}

function Sidebar({ pathname }: { pathname: string }) {
  const { openSheet } = useGeneration();
  const counts = useCounts();
  return <aside className="sidebar" aria-label="Nawigacja główna">
    <Link href="/" className="sidebar-brand" aria-label="CookingTube — start"><Wordmark /></Link>
    <button className="btn btn-primary sidebar-new" onClick={() => openSheet()}><Plus size={19} /> Nowy przepis</button>
    <nav><ul>
      {nav.map(({ href, label, icon: Icon }) => <li key={href}>
        <Link href={href} className={`sidebar-link ${isActive(pathname, href) ? "is-active" : ""}`} aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.9} /><span>{label}</span>{!!counts[href] && <span className="count">{counts[href]}</span>}
        </Link>
      </li>)}
    </ul></nav>
    <div className="sidebar-note">
      <img src="/images/insp-soup.webp" alt="" />
      <p><strong>Wszystko zostaje u Ciebie.</strong> Przepisy i lista zakupów zapisują się tylko w tej przeglądarce.</p>
    </div>
  </aside>;
}

function BottomNav({ pathname }: { pathname: string }) {
  const { openSheet } = useGeneration();
  const counts = useCounts();
  const item = ({ href, label, icon: Icon }: typeof nav[number]) => <Link key={href} href={href} className={`tab ${isActive(pathname, href) ? "is-active" : ""}`} aria-current={isActive(pathname, href) ? "page" : undefined}>
    <span className="tab-icon"><Icon size={22} strokeWidth={isActive(pathname, href) ? 2.3 : 1.9} />{href === "/zakupy" && !!counts[href] && <span className="dot">{counts[href]}</span>}</span>{label}
  </Link>;
  return <nav className="bottom-nav" aria-label="Nawigacja główna">
    {item(nav[0])}{item(nav[1])}
    <button className="fab" onClick={() => openSheet()} aria-label="Nowy przepis z filmu"><Plus size={26} strokeWidth={2.4} /></button>
    {item(nav[2])}{item(nav[3])}
  </nav>;
}
