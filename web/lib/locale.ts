export type AppLocale = "pl" | "en";

/** The first preferred browser language determines the UI; unsupported locales use English. */
export function localeFromLanguage(value?: string | null): AppLocale {
  const preferred = (value || "en").split(",")[0].split(";")[0].trim().toLowerCase();
  return preferred === "pl" || preferred.startsWith("pl-") ? "pl" : "en";
}
export function requestLocale(request: Request): AppLocale {
  const explicit = new URL(request.url).searchParams.get("lang") || request.headers.get("x-app-locale");
  return explicit === "pl" || explicit === "en" ? explicit : localeFromLanguage(request.headers.get("accept-language"));
}

const errors: Record<string, string> = {
  "Odśwież stronę i spróbuj ponownie.": "Refresh the page and try again.",
  "Nie udało się odczytać linku. Spróbuj ponownie.": "We could not read the link. Please try again.",
  "Wklej prawidłowy link do filmu z YouTube.": "Paste a valid YouTube video link.",
  "Przygotowujemy teraz kilka przepisów. Spróbuj ponownie za chwilę.": "A few recipes are being prepared. Please try again shortly.",
  "Zezwól na zapis danych tej aplikacji w przeglądarce i spróbuj ponownie.": "Allow this app to store browser data, then try again.",
  "Osiągnięto chwilowy limit albo ten film jest już analizowany. Spróbuj ponownie za kilka minut.": "The temporary limit has been reached or this video is already being analysed. Try again in a few minutes.",
  "Przygotowanie trwało zbyt długo lub zostało anulowane. Spróbuj ponownie.": "Preparation timed out or was cancelled. Please try again.",
  "Nie udało się przygotować przepisu. Spróbuj ponownie lub wybierz inny film.": "We could not prepare a recipe. Try again or choose another video.",
  "Przygotowywanie przepisów jest chwilowo niedostępne. Spróbuj ponownie później.": "Recipe generation is temporarily unavailable. Please try again later.",
  "Przygotowywanie przepisów jest chwilowo niedostępne.": "Recipe generation is temporarily unavailable.",
  "Nie udało się dokończyć przepisu. Spróbuj ponownie.": "We could not finish the recipe. Please try again.",
  "Nie znaleźliśmy treści potrzebnej do przygotowania przepisu. Wybierz inny film.": "We could not find enough information for a recipe. Choose another video.",
  "Wykorzystaliśmy chwilowy limit przygotowywania przepisów. Spróbuj ponownie później.": "The temporary recipe generation limit has been reached. Please try again later.",
  "Nie udało się odczytać tego filmu. Wybierz publiczny film z jednym przepisem, dostępny bez logowania.": "We could not access this video. Choose a public video with one recipe that does not require signing in.",
  "Przygotowywanie przepisów jest teraz przeciążone. Spróbuj ponownie za chwilę.": "Recipe generation is currently busy. Please try again shortly.",
  "Nie udało się teraz przygotować przepisu. Spróbuj ponownie za chwilę.": "We could not prepare the recipe right now. Please try again shortly.",
  "Nie udało się ułożyć pewnej oceny filmu. Wybierz wyraźny film z jednym przepisem.": "We could not reliably assess this video. Choose a clear video showing a single recipe.",
  "Nie znaleźliśmy w tym filmie przygotowania jednej potrawy. Wybierz film pokazujący składniki i kolejne czynności gotowania.": "This video does not clearly show how to prepare one dish. Choose a cooking video showing ingredients and preparation steps.",
  "Ten film jest za długi. Wybierz film z jednym przepisem, krótszy niż godzinę.": "This video is too long. Choose a single-recipe video under one hour.",
  "Nie udało się ułożyć czytelnego przepisu. Spróbuj ponownie lub wybierz krótszy film.": "We could not create a clear recipe. Try again or choose a shorter video.",
  "Nie znaleźliśmy kompletnego przepisu. Wybierz film pokazujący składniki i przygotowanie jednej potrawy.": "We could not find a complete recipe. Choose a video showing ingredients and preparation of one dish.",
  "Nie udało się ułożyć spójnego przepisu. Spróbuj ponownie lub wybierz inny film.": "We could not create a consistent recipe. Try again or choose another video.",
  "Nieprawidłowy identyfikator przepisu.": "Invalid recipe ID.",
  "Nie udało się odczytać zapisanego przepisu. Spróbuj ponownie.": "We could not read the saved recipe. Please try again.",
  "Nie udało się odczytać przepisu.": "We could not read this recipe.",
  "Nieprawidłowy przepis.": "Invalid recipe.",
  "Przepis jest za duży, aby zapisać go w bibliotece.": "This recipe is too large to save to the library.",
  "Biblioteka osiągnęła limit 200 MB. Zapis nowych przepisów jest wstrzymany.": "The library has reached its 200 MB limit. New recipes cannot be saved.",
  "Nie udało się zapisać przepisu.": "We could not save the recipe.",
  "Nie udało się odczytać głosu.": "We could not read your vote.",
  "Ten przepis nie jest jeszcze zapisany w bibliotece.": "This recipe has not been saved to the shared library yet.",
  "Nie znaleziono tego przepisu.": "This recipe could not be found.",
  "Nieprawidłowa strona biblioteki.": "Invalid library page.",
  "Biblioteka jest chwilowo niedostępna. Spróbuj ponownie.": "The library is temporarily unavailable. Please try again.",
  "Wspólna biblioteka będzie dostępna po uruchomieniu wersji Cloudflare. Przepisy możesz zachować na tym urządzeniu.": "The shared library will be available with the Cloudflare release. You can keep recipes on this device.",
  "Głosowanie będzie dostępne po uruchomieniu wspólnej biblioteki.": "Voting will be available when the shared library is launched.",
  "Nieprawidłowy głos.": "Invalid vote.",
  "Nie udało się zapisać głosu. Spróbuj ponownie.": "We could not save your vote. Please try again.",
  "Przepis jest gotowy, ale zapis w bibliotece się nie powiódł. Zachowaj go na tym urządzeniu i spróbuj otworzyć go ponownie później.": "Your recipe is ready, but could not be saved to the shared library. Keep it on this device and try opening it again later.",
};
export function localizeMessage(message: string, locale: AppLocale) {
  return locale === "pl" ? message : errors[message] ?? "Something went wrong. Please try again.";
}
