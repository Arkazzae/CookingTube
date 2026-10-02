import { formatVideoRecipe, videoRecipeInstructions, recipeSchema } from "./recipe-format.ts";
import { limitedText } from "./video.ts";

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiError("Przygotowywanie przepisów jest chwilowo niedostępne. Spróbuj ponownie później.", 503);
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  if (!["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"].includes(model)) throw new GeminiError("Przygotowywanie przepisów jest chwilowo niedostępne.", 503);
  return { apiKey, model };
}

type Interaction = { status?: string; steps?: { type: string; content?: { type: string; text?: string }[] }[] };
export function readGeminiOutput(data: Interaction): string {
  if (data.status !== "completed") throw new GeminiError("Nie udało się dokończyć przepisu. Spróbuj ponownie.");
  const output = data.steps?.filter(step => step.type === "model_output").flatMap(step => step.content ?? [])
    .filter(part => part.type === "text").map(part => part.text ?? "").join("");
  if (!output?.trim()) throw new GeminiError("Nie znaleźliśmy treści potrzebnej do przygotowania przepisu. Wybierz inny film.", 422);
  return output;
}

export async function generateRecipe(id: string, signal?: AbortSignal) {
  if (!/^[\w-]{11}$/.test(id)) throw new GeminiError("Wklej prawidłowy link do filmu z YouTube.", 400);
  const { apiKey, model } = geminiConfig();
  const timeout = AbortSignal.timeout(120_000);
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", redirect: "manual",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model, input: [
        { type: "video", uri: `https://www.youtube.com/watch?v=${id}` },
        { type: "text", text: "Przygotuj przepis z tego filmu zgodnie z instrukcjami. Zwróć cały przepis w jednym JSON." },
      ], system_instruction: videoRecipeInstructions, store: false,
      generation_config: { max_output_tokens: 6000, thinking_level: "low", thinking_summaries: "none" },
      response_format: { type: "text", mime_type: "application/json", schema: recipeSchema },
    }),
  });
  if (!response.ok) {
    // Never return provider bodies or request headers: they may contain credential details.
    await response.body?.cancel();
    if (response.status === 429) throw new GeminiError("Wykorzystaliśmy chwilowy limit przygotowywania przepisów. Spróbuj ponownie później.", 429);
    if (response.status === 400) throw new GeminiError("Nie udało się odczytać tego filmu. Wybierz publiczny film z jednym przepisem, dostępny bez logowania.", 422);
    if ([401, 403, 404].includes(response.status)) throw new GeminiError("Przygotowywanie przepisów jest chwilowo niedostępne. Spróbuj ponownie później.", 503);
    if (response.status === 503) throw new GeminiError("Przygotowywanie przepisów jest teraz przeciążone. Spróbuj ponownie za chwilę.", 503);
    throw new GeminiError("Nie udało się teraz przygotować przepisu. Spróbuj ponownie za chwilę.");
  }
  const data = JSON.parse(await limitedText(response, 200_000)) as Interaction;
  return formatVideoRecipe(readGeminiOutput(data), id);
}
