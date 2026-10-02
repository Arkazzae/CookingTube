import { requestLocale, localizeMessage } from "../../../lib/locale.ts";
import { getLibrary, LibraryError } from "../../../lib/library.server.ts";
import { sameOrigin, jsonError as rawJsonError } from "../../../lib/http.ts";
import { limitedText } from "../../../lib/video.ts";

export async function POST(request: Request) {
  const locale = requestLocale(request);
  const jsonError = (message: string, status: number) => rawJsonError(localizeMessage(message, locale), status);
  if (!sameOrigin(request)) return jsonError("Odśwież stronę i spróbuj ponownie.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return jsonError("Nieprawidłowy głos.", 400);
  const library = getLibrary(locale);
  if (!library) return jsonError("Głosowanie będzie dostępne po uruchomieniu wspólnej biblioteki.", 503);
  let body;
  try { body = JSON.parse(await limitedText(new Response(request.body), 1024)); }
  catch { return jsonError("Nieprawidłowy głos.", 400); }
  if (!body || typeof body.id !== "string" || typeof body.value !== "number") return jsonError("Nieprawidłowy głos.", 400);
  try {
    return Response.json(await library.vote(body.id, request.headers.get("x-voter-id") ?? "", body.value), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof LibraryError ? error.message : "Nie udało się zapisać głosu. Spróbuj ponownie.", error instanceof LibraryError ? error.status : 503); }
}
