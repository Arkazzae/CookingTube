"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChefHat, Heart, House, Plus, ShoppingBasket, Timer } from "lucide-react";
import { Toaster } from "sonner";
import type { AppLocale } from "@/lib/locale";
import { useHydrated, useLibrary } from "@/lib/local-library";
import { useTimers } from "@/lib/kitchen-timers";
import { PwaStatus } from "@/components/pwa-status";
import { GenerationProvider, useGeneration } from "./generation";
import { GenerationOverlay } from "./generation-overlay";
import { LinkForm } from "./link-form";
import { Sheet } from "./sheet";
import { Wordmark } from "./brand";
import { LanguageSwitch, LocaleProvider, useT } from "./locale";
import { TimerProvider, useTimerCenter } from "./timers";

const nav = [
  { href: "/", key: "home", icon: House },
  { href: "/przepisy", key: "recipes", icon: BookOpen },
  { href: "/ulubione", key: "favorites", icon: Heart },
  { href: "/zakupy", key: "shopping", icon: ShoppingBasket },
] as const;

export function AppShell({ locale, children }: { locale: AppLocale; children: React.ReactNode }) {
  return <LocaleProvider initial={locale}><GenerationProvider><TimerProvider><Shell>{children}</Shell></TimerProvider></GenerationProvider></LocaleProvider>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  // Cooking mode and the printable card take the whole screen.
  const immersive = pathname.endsWith("/gotuj") || pathname.endsWith("/pdf");
  // Recipe pages add a floating "start cooking" bar above the tab bar on phones.
  const detail = pathname.startsWith("/przepis/");
  const { sheetOpen, closeSheet, draft } = useGeneration();
  return <div className={`shell ${immersive ? "shell--immersive" : ""} ${detail ? "shell--detail" : ""}`}>
    <a href="#tresc" className="skip-link">{t.nav.skip}</a>
    {!immersive && <Sidebar pathname={pathname} />}
    <main id="tresc" className="shell-main">{children}</main>
    {!immersive && <BottomNav pathname={pathname} />}
    <GenerationOverlay />
    <Sheet open={sheetOpen} onClose={closeSheet} title={t.shell.sheetTitle} description={t.shell.sheetDescription}>
      <LinkForm variant="sheet" initial={draft} autoFocus />
      <ul className="sheet-tips">{t.shell.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
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
  const t = useT();
  const { openSheet } = useGeneration();
  const { open: openTimer } = useTimerCenter();
  const timers = useTimers();
  const hydrated = useHydrated();
  const counts = useCounts();
  return <aside className="sidebar" aria-label={t.nav.main}>
    <Link href="/" className="sidebar-brand" aria-label={t.nav.homeAria}><Wordmark /></Link>
    <button className="btn btn-primary sidebar-new" onClick={() => openSheet()}><Plus size={19} /> {t.nav.newRecipe}</button>
    <nav><ul>
      {nav.map(({ href, key, icon: Icon }) => <li key={href}>
        <Link href={href} className={`sidebar-link ${isActive(pathname, href) ? "is-active" : ""}`} aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.9} /><span>{t.nav[key]}</span>{!!counts[href] && <span className="count">{counts[href]}</span>}
        </Link>
      </li>)}
      <li><button className="sidebar-link" onClick={openTimer}><Timer size={20} strokeWidth={1.9} /><span>{t.nav.timer}</span>{hydrated && timers.length > 0 && <span className="count count--live">{timers.length}</span>}</button></li>
    </ul></nav>
    <div className="sidebar-foot">
      <LanguageSwitch />
      <div className="sidebar-note">
        <img src="/images/insp-soup.webp" alt="" />
        <p><strong>{t.shell.noteTitle}</strong> {t.shell.noteText}</p>
        <div className="sidebar-pwa"><PwaStatus /></div>
      </div>
    </div>
  </aside>;
}

function BottomNav({ pathname }: { pathname: string }) {
  const t = useT();
  const { openSheet } = useGeneration();
  const counts = useCounts();
  const item = ({ href, key, icon: Icon }: typeof nav[number]) => <Link key={href} href={href} className={`tab ${isActive(pathname, href) ? "is-active" : ""}`} aria-current={isActive(pathname, href) ? "page" : undefined}>
    <span className="tab-icon"><Icon size={22} strokeWidth={isActive(pathname, href) ? 2.3 : 1.9} />{href === "/zakupy" && !!counts[href] && <span className="dot">{counts[href]}</span>}</span>{t.nav[key]}
  </Link>;
  // On a recipe the centre button becomes the way into cooking mode, so the page needs no second bar.
  const recipe = pathname.match(/^\/przepis\/([\w-]+)$/)?.[1];
  return <nav className="bottom-nav" aria-label={t.nav.main}>
    {item(nav[0])}{item(nav[1])}
    {recipe ? <Link href={`/przepis/${recipe}/gotuj`} className="tab tab--action" aria-label={t.nav.cookAria}>
        <span className="tab-orb" key="cook"><ChefHat size={24} strokeWidth={2.1} /></span>{t.nav.cook}
      </Link>
      : <button className="tab tab--action" onClick={() => openSheet()} aria-label={t.nav.newFromVideo}>
        <span className="tab-orb" key="new"><Plus size={26} strokeWidth={2.4} /></span>{t.nav.new}
      </button>}
    {item(nav[2])}{item(nav[3])}
  </nav>;
}
