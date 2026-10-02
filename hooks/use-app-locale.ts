"use client";
import { useSyncExternalStore } from "react";
import { localeFromLanguage } from "../lib/locale";
function subscribe(listener: () => void) {
  window.addEventListener("languagechange", listener);
  return () => window.removeEventListener("languagechange", listener);
}
export function useAppLocale() {
  return useSyncExternalStore(subscribe, () => localeFromLanguage(navigator.languages?.[0] || navigator.language), () => "en" as const);
}
