import { requestLocale, localizeMessage } from "../../../lib/locale.ts";
import { getLibrary, LibraryError, validId, validVoter } from "../../../lib/library.server.ts";
import { jsonError as rawJsonError } from "../../../lib/http.ts";

export async function GET(request: Request) {
  const locale = requestLocale(request);
  const jsonError = (message: string, status: number) => rawJsonError(localizeMessage(message, locale), status);
  const library = getLibrary(locale);
  if (!library) return jsonError("Wspólna biblioteka będzie dostępna po uruchomieniu wersji Cloudflare. Przepisy możesz zachować na tym urządzeniu.", 503);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (id) {
      if (!validId(id)) return jsonError("Nieprawidłowy identyfikator przepisu.", 400);
      const recipe = await library.get(id);
      if (!recipe) return jsonError("Nie znaleziono tego przepisu.", 404);
      const voter = request.headers.get("x-voter-id") ?? "";
      return Response.json({ recipe, ...(await library.votes(id, validVoter(voter) ? voter : "")) }, { headers: { "Cache-Control": "no-store" } });
    }
    const offset = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return jsonError("Nieprawidłowa strona biblioteki.", 400);
    return Response.json(await library.list(offset), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error instanceof LibraryError ? error.message : "Biblioteka jest chwilowo niedostępna. Spróbuj ponownie.", error instanceof LibraryError ? error.status : 503); }
}
