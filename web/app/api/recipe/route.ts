import { parseVideoId } from "../../../lib/youtube-url.ts";
import { limitedText } from "../../../lib/video.ts";
import { GeminiError, generateRecipe } from "../../../lib/gemini.ts";
import type { Recipe } from "../../../lib/recipe.ts";

export const runtime = "nodejs";
export const maxDuration = 180;
const cache = new Map<string, { recipe: Recipe; expires: number }>();
let activeRequests = 0;
function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  // Next can reconstruct request.url with an internal hostname. The Host header
  // retains the public host (and port) used by the browser or Vercel proxy.
  const publicUrl = new URL(request.url);
  publicUrl.host = request.headers.get("host") || publicUrl.host;
  if (origin && origin !== publicUrl.origin) return failure("Odśwież stronę i spróbuj ponownie.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return failure("Nie udało się odczytać linku. Spróbuj ponownie.", 400);
  let body: unknown;
  try { body = JSON.parse(await limitedText(new Response(request.body), 4096)); }
  catch { return failure("Wklej prawidłowy link do filmu z YouTube.", 400); }
  const url = body && typeof body === "object" && "url" in body ? body.url : null;
  const id = typeof url === "string" && url.length <= 2048 ? parseVideoId(url) : null;
  if (!id) return failure("Wklej prawidłowy link do filmu z YouTube.", 400);
  const saved = cache.get(id);
  if (saved && saved.expires > Date.now()) return Response.json({ recipe: saved.recipe }, { headers: { "Cache-Control": "no-store" } });
  // Bound concurrent work per server instance; the provider also enforces its account quota.
  if (activeRequests >= 2) return failure("Przygotowujemy teraz kilka przepisów. Spróbuj ponownie za chwilę.", 429);
  activeRequests++;
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(130_000)]);
    const recipe = await generateRecipe(id, signal);
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(id, { recipe, expires: Date.now() + 60 * 60_000 });
    return Response.json({ recipe }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GeminiError) return failure(error.message, error.status);
    if (error instanceof Error && /TimeoutError|AbortError/.test(error.name)) return failure("Przygotowanie trwało zbyt długo lub zostało anulowane. Spróbuj ponownie.", 504);
    // Recipe validation errors are safe, Polish messages; other upstream errors stay private.
    if (error instanceof Error && /^(Ten film|Nie znaleźliśmy|Nie udało się ułożyć|W filmie)/.test(error.message)) return failure(error.message, 422);
    return failure("Nie udało się przygotować przepisu. Spróbuj ponownie lub wybierz inny film.", 502);
  } finally { activeRequests--; }
}
