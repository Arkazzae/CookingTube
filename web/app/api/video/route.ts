import { parseVideoId } from "@/lib/youtube-url";
import { limitedText, loadVideo, VideoError } from "@/lib/video";
export const maxDuration = 60;
function failure(error: string, status: number) { return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return failure("Odśwież stronę i spróbuj ponownie.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return failure("Nie udało się odczytać linku. Spróbuj ponownie.", 400);
  let body: unknown;
  try { body = JSON.parse(await limitedText(new Response(request.body), 4096)); }
  catch { return failure("Wklej prawidłowy link do filmu z YouTube.", 400); }
  const url = body && typeof body === "object" && "url" in body ? body.url : null;
  const id = typeof url === "string" && url.length <= 2048 ? parseVideoId(url) : null;
  if (!id) return failure("Wklej prawidłowy link do filmu z YouTube.", 400);
  try {
    const source = await loadVideo(id);
    return Response.json({ source }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VideoError) return failure(error.message, 422);
    console.warn("Video source request failed:", error instanceof Error ? error.message : "Unknown error");
    // The browser receives only bounded source text, never upstream HTML or errors.
    return failure("Nie udało się odczytać filmu. Spróbuj ponownie za chwilę lub wybierz inny film.", 502);
  }
}
