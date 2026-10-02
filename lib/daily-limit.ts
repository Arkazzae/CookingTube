import { getCloudflare } from "./cloudflare-context.ts";

// Fresh AI generations per person in a rolling 24-hour window. Opening a recipe that is already cached or stored
// in the shared library never counts. DAILY_RECIPE_LIMIT overrides the default; 0 turns the limit off.
const WINDOW = 24 * 60 * 60_000;
export function dailyLimit() {
  const value = Number(process.env.DAILY_RECIPE_LIMIT ?? 5);
  return Number.isInteger(value) && value >= 0 ? value : 5;
}

export type Quota = { limit: number; used: number; remaining: number; resetAt: number | null };
type Store = { usage(subjects: string[], since: number): Promise<Map<string, number[]>>; record(subjects: string[], at: number): Promise<void> };

// A person is both their browser ID and their network address, so clearing site data does not reset the limit.
// Addresses are kept only as salted hashes, and only for the window.
export async function subjectsFor(request: Request) {
  const subjects: string[] = [];
  const voter = request.headers.get("x-voter-id");
  if (voter && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(voter)) subjects.push(`v:${voter.toLowerCase()}`);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) subjects.push(`ip:${await digest(ip)}`);
  return subjects;
}
async function digest(value: string) {
  const data = new TextEncoder().encode(`${process.env.RATE_LIMIT_SALT ?? "cookingtube-daily"}:${value}`);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

const memory = new Map<string, number[]>();
const memoryStore: Store = {
  async usage(subjects, since) {
    return new Map(subjects.map(subject => {
      const kept = (memory.get(subject) ?? []).filter(at => at > since);
      memory.set(subject, kept);
      return [subject, kept];
    }));
  },
  async record(subjects, at) {
    for (const subject of subjects) memory.set(subject, [...(memory.get(subject) ?? []), at]);
    if (memory.size > 5000) for (const [subject, times] of memory) if (!times.some(t => t > at - WINDOW)) memory.delete(subject);
  },
};
function d1Store(db: D1Database): Store {
  return {
    async usage(subjects, since) {
      const rows = await db.prepare(`SELECT subject, created_at FROM daily_generations WHERE created_at > ? AND subject IN (${subjects.map(() => "?").join(",")}) ORDER BY created_at`)
        .bind(since, ...subjects).all<{ subject: string; created_at: number }>();
      const usage = new Map<string, number[]>(subjects.map(subject => [subject, []]));
      for (const row of rows.results) usage.get(row.subject)?.push(row.created_at);
      return usage;
    },
    async record(subjects, at) {
      await db.batch([
        db.prepare("DELETE FROM daily_generations WHERE created_at < ?").bind(at - WINDOW),
        ...subjects.map(subject => db.prepare("INSERT INTO daily_generations (subject, created_at) VALUES (?, ?)").bind(subject, at)),
      ]);
    },
  };
}
// Cloudflare keeps the count in D1 across instances; elsewhere it is per server instance (best effort).
const store = () => { const db = getCloudflare()?.DB; return db ? d1Store(db) : memoryStore; };

/** The strictest of the person's subjects decides: used generations and when the oldest one leaves the window. */
export async function quotaFor(subjects: string[], now = Date.now()): Promise<Quota> {
  const limit = dailyLimit();
  // limit 0 means unlimited; without any subject (no headers at all) there is nothing to count against.
  if (!limit || !subjects.length) return { limit, used: 0, remaining: limit, resetAt: null };
  let usage: Map<string, number[]>;
  // A storage failure (for example a missing migration) must not take recipe generation down with it.
  try { usage = await store().usage(subjects, now - WINDOW); }
  catch (error) { console.warn("daily_limit_unavailable", error instanceof Error ? error.message : error); return { limit, used: 0, remaining: limit, resetAt: null }; }
  let used = 0, resetAt: number | null = null;
  for (const times of usage.values()) {
    if (times.length > used) used = times.length;
    if (times.length >= limit) resetAt = Math.max(resetAt ?? 0, times[times.length - limit] + WINDOW);
  }
  return { limit, used: Math.min(used, limit), remaining: Math.max(0, limit - used), resetAt };
}

export async function recordGeneration(subjects: string[], now = Date.now()) {
  if (!dailyLimit() || !subjects.length) return;
  try { await store().record(subjects, now); }
  catch (error) { console.warn("daily_limit_record_failed", error instanceof Error ? error.message : error); }
}
