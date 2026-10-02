/**
 * The real length of a public YouTube video, read from its watch page ("lengthSeconds"), or null when YouTube
 * does not answer in time. The page is streamed and reading stops as soon as the value appears.
 */
export async function youtubeLength(id: string, signal?: AbortSignal): Promise<number | null> {
  // YOUTUBE_LENGTH_LOOKUP=off skips the lookup (tests, or if YouTube starts blocking it); timelines then rely
  // on the model's own length.
  if (process.env.YOUTUBE_LENGTH_LOOKUP === "off" || !/^[\w-]{11}$/.test(id)) return null;
  try {
    const timeout = AbortSignal.timeout(6000);
    const response = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { "Accept-Language": "en", "User-Agent": "Mozilla/5.0 (compatible; CookingTube/1.0)" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect: "follow",
    });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = "", read = 0;
    try {
      while (read < 4_000_000) {
        const { done, value } = await reader.read();
        if (done) break;
        read += value.byteLength;
        // Keep a short tail so a match split across chunks is still found.
        text = text.slice(-64) + decoder.decode(value, { stream: true });
        const match = text.match(/"lengthSeconds":"(\d{1,6})"/);
        if (match) { const seconds = Number(match[1]); return seconds > 0 ? seconds : null; }
      }
    } finally { void reader.cancel().catch(() => {}); }
    return null;
  } catch { return null; }
}
