import { parseVideoId } from "../../../lib/youtube-url.ts";
import { limitedText } from "../../../lib/video.ts";
import { GeminiError, generateRecipe } from "../../../lib/gemini.ts";
import type { Recipe } from "../../../lib/recipe.ts";
import { getLibrary, LibraryError, validVoter } from "../../../lib/library.server.ts";
import { requestLocale, localizeMessage } from "../../../lib/locale.ts";
import { sameOrigin, jsonError } from "../../../lib/http.ts";

export const runtime = "nodejs";
export const maxDuration = 180;
const cache = new Map<string, { recipe: Recipe; expires: number }>();
let activeRequests = 0;
export async function POST(request: Request) {
  const locale = requestLocale(request);
  const failure = (message: string, status: number) => jsonError(localizeMessage(message, locale), status);
  if (!sameOrigin(request)) return failure("Odśwież stronę i spróbuj ponownie.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return failure("Nie udało się odczytać linku. Spróbuj ponownie.", 400);
  let body: unknown;
  try { body = JSON.parse(await limitedText(new Response(request.body), 4096)); }
  catch { return failure("Wklej prawidłowy link do filmu z YouTube.", 400); }
  const url = body && typeof body === "object" && "url" in body ? body.url : null;
  const id = typeof url === "string" && url.length <= 2048 ? parseVideoId(url) : null;
  if (!id) return failure("Wklej prawidłowy link do filmu z YouTube.", 400);
  const library = getLibrary(locale);
  const cacheKey = `${locale}:${id}`;
  const saved = !library ? cache.get(cacheKey) : null;
  if (saved && saved.expires > Date.now()) return Response.json({ recipe: saved.recipe, saved: false }, { headers: { "Cache-Control": "no-store" } });
  // Bound concurrent work per server instance; the provider also enforces its account quota.
  if (activeRequests >= 2) return failure("Przygotowujemy teraz kilka przepisów. Spróbuj ponownie za chwilę.", 429);
  activeRequests++;
  let lease: string | undefined;
  try {
    if (library) {
      const stored = await library.get(id);
      if (stored) return Response.json({ recipe: stored, saved: true }, { headers: { "Cache-Control": "no-store" } });
      const voter = request.headers.get("x-voter-id") ?? "";
      if (!validVoter(voter)) return failure("Zezwól na zapis danych tej aplikacji w przeglądarce i spróbuj ponownie.", 400);
      lease = await library.acquire(id, voter);
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(130_000)]);
    let recipe: Recipe = await generateRecipe(id, signal, locale);
    let persisted = false;
    let warning: string | undefined;
    if (library) {
      try { recipe = await library.save(id, recipe); persisted = true; }
      catch (error) { warning = error instanceof LibraryError ? error.message : "Przepis jest gotowy, ale zapis w bibliotece się nie powiódł. Zachowaj go na tym urządzeniu i spróbuj otworzyć go ponownie później."; }
    } else {
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { recipe, expires: Date.now() + 60 * 60_000 });
    }
    return Response.json({ recipe, saved: persisted, warning: warning ? localizeMessage(warning, locale) : undefined }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GeminiError) return failure(error.message, error.status);
    if (error instanceof LibraryError) return failure(error.message, error.status);
    if (error instanceof Error && /TimeoutError|AbortError/.test(error.name)) return failure("Przygotowanie trwało zbyt długo lub zostało anulowane. Spróbuj ponownie.", 504);
    // Recipe validation errors are safe, Polish messages; other upstream errors stay private.
    if (error instanceof Error && /^(Ten film|Nie znaleźliśmy|Nie udało się ułożyć|W filmie)/.test(error.message)) return failure(error.message, 422);
    return failure("Nie udało się przygotować przepisu. Spróbuj ponownie lub wybierz inny film.", 502);
  } finally {
    activeRequests--;
    if (lease && library) {
      try { await library.release(lease); }
      catch { console.warn("generation_lease_release_failed"); /* The persisted lease expires automatically. */ }
    }
  }
}
