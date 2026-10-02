import { cookies, headers } from "next/headers";
import { localeFromLanguage, type AppLocale } from "./locale";
import { dictionaries, LOCALE_COOKIE } from "./i18n";

/** The viewer's choice (cookie) wins; otherwise the browser's preferred language decides. */
export async function serverLocale(): Promise<AppLocale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (chosen === "pl" || chosen === "en") return chosen;
  return localeFromLanguage((await headers()).get("accept-language"));
}

export async function serverDictionary() {
  return dictionaries[await serverLocale()];
}
