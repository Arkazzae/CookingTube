import type { VideoSource } from "./video";
import { buildRecipeInput, formatRecipe, recipeInstructions, recipeSchema } from "./recipe-format";

export type PreparationProgress = { stage: "source" | "download" | "warmup" | "writing"; percent?: number };
export type DeviceSupport = { available: true } | { available: false; reason: string };
type BrowserGPU = { requestAdapter: (options?: { powerPreference: string }) => Promise<unknown | null> };
export async function checkLocalSupport(): Promise<DeviceSupport> {
  if (!window.isSecureContext) return { available: false, reason: "Otwórz aplikację przez bezpieczny adres HTTPS lub na localhost." };
  const gpu = (navigator as Navigator & { gpu?: BrowserGPU }).gpu;
  if (!gpu || typeof Worker === "undefined") return { available: false, reason: "Ta przeglądarka nie obsługuje lokalnego przygotowywania przepisów. Otwórz stronę w aktualnym Chrome lub Edge z włączonym przyspieszeniem sprzętowym (WebGPU)." };
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("No adapter");
    return { available: true };
  } catch { return { available: false, reason: "Przeglądarka nie udostępnia karty graficznej. Włącz przyspieszenie sprzętowe lub otwórz aplikację w innej przeglądarce obsługującej WebGPU." }; }
}
let worker: Worker | null = null;
let running = false;
export function releaseLocalModel() { worker?.terminate(); worker = null; }
function abortError() { return new DOMException("Przygotowywanie anulowane.", "AbortError"); }
export function friendlyLocalError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/memory|out of memory|device.*lost|buffer.*size|allocation/i.test(text)) return "Na urządzeniu zabrakło pamięci do przygotowania przepisu. Zamknij inne karty i spróbuj ponownie.";
  if (/context.*(window|length)|token.*(limit|exceed)|prompt.*long/i.test(text)) return "Ten film jest za długi dla lokalnego modelu. Wybierz krótszy przepis.";
  if (/fetch|network|download|cache|quota|storage/i.test(text)) return "Nie udało się pobrać lub zapisać modelu. Sprawdź połączenie i wolne miejsce, a potem spróbuj ponownie.";
  if (/webgpu|gpu|adapter|shader|vulkan|metal/i.test(text)) return "Nie udało się uruchomić modelu na karcie graficznej. Spróbuj ponownie w aktualnym Chrome lub Edge z włączonym przyspieszeniem sprzętowym.";
  if (/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(text) && /[ąćęłńóśźż]/i.test(text)) return text;
  return "Nie udało się przygotować przepisu na tym urządzeniu. Spróbuj ponownie lub wybierz krótszy film.";
}

export async function generateLocalRecipe(source: VideoSource, signal: AbortSignal, onProgress: (progress: PreparationProgress) => void) {
  if (running) throw new Error("Przepis już się przygotowuje.");
  const input = buildRecipeInput(source);
  if (signal.aborted) throw abortError();
  running = true;
  try {
    // Prebuilt as a classic worker because LiteRT loads its WASM glue with importScripts.
    worker ??= new Worker("/generated/recipe.worker.js");
    const activeWorker = worker;
    onProgress({ stage: "warmup" });
    const output = await new Promise<string>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      let generating = false;
      function cleanup() {
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
        activeWorker.removeEventListener("message", received);
        activeWorker.removeEventListener("error", failed);
      }
      function timeout(ms: number, message: string) {
        clearTimeout(timer);
        timer = setTimeout(() => { cleanup(); releaseLocalModel(); reject(new Error(message)); }, ms);
      }
      function aborted() { cleanup(); releaseLocalModel(); reject(abortError()); }
      function failed() { cleanup(); releaseLocalModel(); reject(new Error("Nie udało się uruchomić lokalnego modelu. Odśwież stronę i spróbuj ponownie.")); }
      function received(event: MessageEvent) {
        if (event.data.type === "progress") {
          onProgress(event.data.progress);
          if (event.data.progress.stage === "writing" && !generating) {
            generating = true;
            timeout(5 * 60_000, "Przygotowanie trwa zbyt długo na tym urządzeniu. Spróbuj krótszego filmu.");
          }
        } else if (event.data.type === "result") { cleanup(); resolve(event.data.output ?? ""); }
        else if (event.data.type === "error") { cleanup(); reject(new Error(event.data.error)); }
      }
      activeWorker.addEventListener("message", received);
      activeWorker.addEventListener("error", failed);
      signal.addEventListener("abort", aborted, { once: true });
      timeout(12 * 60_000, "Pobieranie trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie.");
      activeWorker.postMessage({ input, instructions: recipeInstructions, schema: JSON.stringify(recipeSchema) });
    });
    if (signal.aborted) throw abortError();
    return formatRecipe(output, source);
  } catch (error) {
    releaseLocalModel();
    if (signal.aborted) throw abortError();
    console.warn("Local recipe generation failed:", error instanceof Error ? error.message : "Unknown error");
    throw new Error(friendlyLocalError(error));
  } finally { running = false; }
}
