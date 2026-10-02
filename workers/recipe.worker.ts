type LocalEngine = import("@litert-lm/core").Engine;
type LocalConversation = import("@litert-lm/core").Conversation;

const MODEL_URL = "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm";
const MODEL_BYTES = 2_969_059_328;
const CACHE_NAME = "cooking-tube-models-v1";
let engine: LocalEngine | null = null;
let running = false;
const progress = (stage: "download" | "warmup" | "writing", percent?: number) => self.postMessage({ type: "progress", progress: { stage, percent } });

async function loadEngine() {
  if (engine) return engine;
  const cache = await caches.open(CACHE_NAME);
  let cached = await cache.match(MODEL_URL);
  if (!cached?.body) {
    progress("download", 0);
    const response = await fetch(MODEL_URL);
    if (!response.ok || !response.body) throw new Error("Model download failed");
    const total = Number(response.headers.get("content-length")) || MODEL_BYTES;
    let received = 0, lastPercent = -1;
    const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        const percent = Math.min(99, Math.floor(received / total * 100));
        if (percent !== lastPercent) { progress("download", percent); lastPercent = percent; }
        controller.enqueue(chunk);
      },
      flush() { if (received !== total) throw new Error("Model download incomplete"); },
    }));
    // Cache.put commits only a complete stream, so interrupted downloads never become a usable model.
    await cache.put(MODEL_URL, new Response(stream, { headers: { "Content-Type": "application/octet-stream" } }));
    cached = await cache.match(MODEL_URL);
  }
  if (!cached?.body) throw new Error("Model cache unavailable");
  progress("warmup");
  const { Engine } = await import("@litert-lm/core");
  // Emscripten resolves assets relative to the worker URL, not the imported CDN script.
  // Supply its asset locator so it fetches the matching binary instead of our HTML fallback.
  (self as typeof self & { Module?: { locateFile: (file: string) => string } }).Module = {
    locateFile: file => `https://cdn.jsdelivr.net/npm/@litert-lm/core@0.17.1/wasm/${file}`,
  };
  engine = await Engine.create({ model: cached.body, mainExecutorSettings: { maxNumTokens: 8192 } });
  return engine;
}

self.onmessage = async (event: MessageEvent<{ input: string; instructions: string; schema: string }>) => {
  if (running) return;
  running = true;
  let conversation: LocalConversation | null = null;
  try {
    const model = await loadEngine();
    progress("writing");
    conversation = await model.createConversation({
      preface: {
        messages: [{ role: "system", content: event.data.instructions + "\n\nRequired output JSON schema:\n" + event.data.schema }],
        extra_context: { enable_thinking: false },
      },
      sessionConfig: { maxOutputTokens: 3000, samplerParams: { temperature: 0.7, p: 0.95, k: 64 } },
    });
    const result = await conversation.sendMessage(event.data.input + "\n\nPrzygotuj pełny przepis po polsku. Zwróć wyłącznie JSON.");
    const output = typeof result.content === "string" ? result.content : result.content?.map(part => part.type === "text" ? part.text : "").join("");
    await conversation.delete(); conversation = null;
    self.postMessage({ type: "result", output });
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  } finally {
    if (conversation) await conversation.delete().catch(() => {});
    running = false;
  }
};
