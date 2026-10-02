"use client";
import { useSyncExternalStore } from "react";
import { localeFromLanguage, type AppLocale } from "../lib/locale";

// The interface's language switch stores its choice in this cookie; the browser language is the fallback.
const COOKIE = "cookingtube-locale";
function subscribe(listener: () => void) {
  window.addEventListener("languagechange", listener);
  window.addEventListener("cookingtube-locale", listener);
  return () => { window.removeEventListener("languagechange", listener); window.removeEventListener("cookingtube-locale", listener); };
}
function current(): AppLocale {
  const chosen = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(pl|en)`))?.[1];
  return chosen === "pl" || chosen === "en" ? chosen : localeFromLanguage(navigator.languages?.[0] || navigator.language);
}
export function useAppLocale() {
  return useSyncExternalStore(subscribe, current, () => "en" as const);
}
