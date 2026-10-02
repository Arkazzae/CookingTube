export class VideoError extends Error {}
export type Segment = { text: string; start: number };
export type VideoSource = { id: string; title: string; author: string | null; description: string; segments: Segment[] };

// The URL submitted by the browser never becomes a fetch target. Only a validated ID is used.
export async function limitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("Response too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

export function extractPlayer(html: string): Record<string, any> | null {
  // Parse the balanced JSON object; braces in strings do not terminate it.
  const match = /(?:var\s+)?ytInitialPlayerResponse\s*=\s*/.exec(html);
  if (!match) return null;
  const start = html.indexOf("{", match.index + match[0].length);
  if (start < 0) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}
export function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, key: string) => {
    if (!key.startsWith("#")) return named[key.toLowerCase()] ?? entity;
    const value = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  });
}
export function parseCaptions(body: string): Segment[] {
  let segments: Segment[] = [];
  try {
    const data = JSON.parse(body);
    segments = (data.events ?? []).filter((e: any) => Array.isArray(e.segs)).map((e: any) => ({ start: Number(e.tStartMs) / 1000, text: e.segs.map((s: any) => s.utf8 ?? "").join("") }));
  } catch {
    const matches = [...body.matchAll(/<text\b[^>]*start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)];
    segments = matches.map(m => ({ start: Number(m[1]), text: decodeEntities(m[2].replace(/<[^>]*>/g, "")) }));
  }
  return segments.map(s => ({ ...s, text: decodeEntities(s.text).replace(/\s+/g, " ").trim() })).filter(s => s.text && Number.isFinite(s.start) && s.start >= 0);
}

export async function loadVideo(id: string, signal?: AbortSignal): Promise<VideoSource> {
  const timeout = (ms: number) => signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
  if (!/^[\w-]{11}$/.test(id)) throw new VideoError("Wklej prawidłowy link do filmu z YouTube.");
  const response = await fetch(`https://www.youtube.com/watch?v=${id}&hl=pl`, {
    headers: { "Accept-Language": "pl,en;q=0.8" }, redirect: "manual", signal: timeout(12000),
  });
  if (!response.ok) throw new VideoError("Nie możemy teraz odczytać tego filmu. Spróbuj ponownie za chwilę.");
  const html = await limitedText(response, 6_000_000);
  const player = extractPlayer(html);
  if (!player?.videoDetails || player.videoDetails.videoId !== id || player.playabilityStatus?.status !== "OK") throw new VideoError("Ten film jest niedostępny. Wybierz publiczny film z przepisem.");
  const details = player.videoDetails;
  if (Number(details.lengthSeconds) > 7200) throw new VideoError("Wybierz krótszy film — do dwóch godzin.");
  if (details.isLiveContent && player.videoDetails.isLive) throw new VideoError("Wybierz zakończony film zamiast transmisji na żywo.");
  // Public player metadata, using the client supported by youtube-transcript-api.
  // Web player caption URLs can return an empty 200 response.
  let captionPlayer = player;
  const publicKey = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/)?.[1];
  if (publicKey) {
    try {
      const alternate = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(publicKey)}`, {
        method: "POST", redirect: "manual", signal: timeout(8000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } }, videoId: id }),
      });
      if (alternate.ok) {
        const data = JSON.parse(await limitedText(alternate, 2_000_000));
        if (data.playabilityStatus?.status === "OK" && data.videoDetails?.videoId === id && data.captions) captionPlayer = data;
      }
    } catch { /* Retain public web metadata when the other player is unavailable. */ }
  }
  const tracks = (captionPlayer.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []) as { baseUrl: string; languageCode: string; kind?: string }[];
  const score = (t: typeof tracks[number]) => (t.languageCode === "pl" ? 0 : t.languageCode === "en" ? 2 : 4) + (t.kind === "asr" ? 1 : 0);
  const track = [...tracks].sort((a, b) => score(a) - score(b))[0];
  let segments: Segment[] = [];
  if (track) {
    const target = new URL(track.baseUrl);
    if (target.protocol === "https:" && ["www.youtube.com", "youtube.com"].includes(target.hostname) && target.pathname === "/api/timedtext" && !target.username && !target.password && !target.port) {
      target.searchParams.delete("fmt");
      try {
        const captions = await fetch(target, { redirect: "manual", signal: timeout(8000) });
        if (captions.ok) segments = parseCaptions(await limitedText(captions, 1_500_000));
      } catch { /* A sufficiently detailed video description is also a valid source. */ }
    }
  }
  const description = String(details.shortDescription ?? "").slice(0, 18000);
  if (segments.map(s => s.text).join(" ").length > 100000) throw new VideoError("Ten film zawiera za dużo treści. Wybierz krótszy przepis.");
  if (segments.length === 0 && description.length < 180) throw new VideoError("Nie udało się odczytać składników i instrukcji z tego filmu. Spróbuj innego przepisu.");
  return { id, title: String(details.title ?? "").slice(0, 300), author: typeof details.author === "string" ? details.author.slice(0, 200) : null, description, segments };
}
