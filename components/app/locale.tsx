"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dictionaries, LOCALE_COOKIE, type Dictionary } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

type LocaleContext = { locale: AppLocale; t: Dictionary; setLocale: (locale: AppLocale) => void };
const Context = createContext<LocaleContext>({ locale: "pl", t: dictionaries.pl, setLocale: () => {} });

export function LocaleProvider({ initial, children }: { initial: AppLocale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState(initial);
  const value = useMemo<LocaleContext>(() => ({
    locale, t: dictionaries[locale],
    setLocale: next => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setState(next);
      // Components that read the browser language (votes, PWA status) listen for this.
      window.dispatchEvent(new Event("cookingtube-locale"));
      // Server-rendered parts (page titles, metadata) follow the cookie.
      router.refresh();
    },
  }), [locale, router]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useLocale = () => useContext(Context);
export const useT = () => useContext(Context).t;

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return <div className={`lang-switch ${compact ? "lang-switch--compact" : ""}`} role="group" aria-label={t.nav.language}>
    {(["pl", "en"] as const).map(code => <button key={code} aria-pressed={locale === code} onClick={() => locale !== code && setLocale(code)} lang={code}>
      {code.toUpperCase()}
    </button>)}
  </div>;
}
