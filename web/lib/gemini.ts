import { formatVideoRecipe, videoRecipeInstructions, videoRecipeSchema } from "./recipe-format.ts";
import { limitedText } from "./video.ts";
import { assessVideo, assessmentInstructions, assessmentSchema } from "./video-assessment.ts";

import type { AppLocale } from "./locale.ts";

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

export async function generateRecipe(id: string, signal?: AbortSignal, locale: AppLocale = "pl") {
  if (!/^[\w-]{11}$/.test(id)) throw new GeminiError("Wklej prawidłowy link do filmu z YouTube.", 400);
  const timeout = AbortSignal.timeout(120_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const assessment = assessVideo(await videoInteraction(id, assessmentInstructions, assessmentSchema, 1800, combined));
  const instructions = locale === "pl" ? videoRecipeInstructions : videoRecipeInstructions.replace(/PO POLSKU/gi, "po angielsku").replace(/polskie nazwy/g, "angielskie nazwy") + "\nAll user-facing recipe content MUST be in English: title, description, ingredients, amounts, steps and notes. Keep evidence in the original language.";
  const output = await videoInteraction(id, instructions, videoRecipeSchema, 6000, combined);
  return { ...formatVideoRecipe(output, id, assessment.durationSeconds), language: locale };
}

async function videoInteraction(id: string, instructions: string, schema: object, maxTokens: number, signal: AbortSignal) {
  const { apiKey, model } = geminiConfig();
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", redirect: "manual",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model, input: [
        { type: "video", uri: `https://www.youtube.com/watch?v=${id}` },
        { type: "text", text: "Przeanalizuj ten film zgodnie z instrukcjami. Zwróć wynik w jednym JSON." },
      ], system_instruction: instructions, store: false,
      generation_config: { max_output_tokens: maxTokens, thinking_level: "low", thinking_summaries: "none" },
      response_format: { type: "text", mime_type: "application/json", schema },
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
  return readGeminiOutput(data);
}
