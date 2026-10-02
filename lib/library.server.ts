import { recipeResultSchema, type Recipe } from "./recipe.ts";
import type { AppLocale } from "./locale.ts";
import { getCloudflare } from "./cloudflare-context.ts";

export class LibraryError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}
export const validId = (id: string) => /^[\w-]{11}$/.test(id);
export const validVoter = (voter: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(voter);
export type LibraryEntry = { id: string; title: string; description: string; created_at: number; score: number };
type StoredRow = { id: string; pending_json: string | null; bytes: number; ready: number };

export class RecipeLibrary {
  private db: D1Database;
  private bucket: R2Bucket;
  private locale: AppLocale;
  constructor(db: D1Database, bucket: R2Bucket, locale: AppLocale = "pl") { this.db = db; this.bucket = bucket; this.locale = locale; }

  async get(id: string): Promise<Recipe | null> {
    if (!validId(id)) throw new LibraryError("Nieprawidłowy identyfikator przepisu.", 400);
    const row = await this.db.prepare("SELECT id, pending_json, bytes, ready FROM recipes WHERE id = ? AND locale = ?").bind(id, this.locale).first<StoredRow>();
    if (!row) return null;
    // A durable outbox makes interrupted uploads recoverable. Concurrent retries
    // upload exactly the same immutable body; no reservation can be lost.
    if (row.pending_json !== null) {
      await this.bucket.put(`recipes/${this.locale}/${id}.json`, row.pending_json, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      await this.db.prepare("UPDATE recipes SET ready = 1, pending_json = NULL WHERE id = ? AND locale = ?").bind(id, this.locale).run();
      return recipeResultSchema.parse(JSON.parse(row.pending_json));
    }
    const object = await this.bucket.get(`recipes/${this.locale}/${id}.json`);
    if (!object || object.size > 65536) throw new LibraryError("Nie udało się odczytać zapisanego przepisu. Spróbuj ponownie.");
    const recipe = recipeResultSchema.parse(await object.json());
    if (recipe.sourceUrl !== `https://www.youtube.com/watch?v=${id}`) throw new LibraryError("Nie udało się odczytać przepisu.");
    return recipe;
  }

  async save(id: string, value: Recipe): Promise<Recipe> {
    const recipe = recipeResultSchema.parse(value);
    if (recipe.language && recipe.language !== this.locale) throw new LibraryError("Nieprawidłowy przepis.", 400);
    if (!validId(id) || recipe.sourceUrl !== `https://www.youtube.com/watch?v=${id}` || value.example) throw new LibraryError("Nieprawidłowy przepis.", 400);
    const body = JSON.stringify(recipe);
    const bytes = new TextEncoder().encode(body).byteLength;
    if (bytes > 65536) throw new LibraryError("Przepis jest za duży, aby zapisać go w bibliotece.", 413);
    try {
      // The trigger reserves bytes atomically with the outbox insert, including
      // concurrent uploads. A duplicate never reserves space a second time.
      await this.db.prepare(`INSERT INTO recipes (id, title, description, created_at, bytes, pending_json, locale)
        SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE id = ? AND locale = ?)`)
        .bind(id, recipe.title, recipe.description, Date.now(), bytes, body, this.locale, id, this.locale).run();
    } catch (error) {
      if (error instanceof Error && /recipe_capacity/.test(error.message)) throw new LibraryError("Biblioteka osiągnęła limit 200 MB. Zapis nowych przepisów jest wstrzymany.", 507);
      throw error;
    }
    const stored = await this.get(id);
    if (!stored) throw new LibraryError("Nie udało się zapisać przepisu.");
    return stored;
  }

  async list(offset = 0) {
    const rows = await this.db.prepare(`SELECT r.id, r.title, r.description, r.created_at,
      COALESCE((SELECT SUM(value) FROM recipe_votes WHERE recipe_id = r.id AND locale = r.locale), 0) AS score
      FROM recipes r WHERE ready = 1 AND locale = ? ORDER BY created_at DESC, id LIMIT 21 OFFSET ?`).bind(this.locale, offset).all<LibraryEntry>();
    return { recipes: rows.results.slice(0, 20), nextOffset: rows.results.length > 20 ? offset + 20 : null };
  }

  async votes(id: string, voter: string) {
    const row = await this.db.prepare(`SELECT COALESCE(SUM(value), 0) AS score,
      COALESCE(MAX(CASE WHEN voter = ? THEN value END), 0) AS myVote FROM recipe_votes WHERE recipe_id = ? AND locale = ?`)
      .bind(voter, id, this.locale).first<{ score: number; myVote: number }>();
    return { score: row?.score ?? 0, myVote: row?.myVote ?? 0 };
  }

  async vote(id: string, voter: string, value: number) {
    if (!validId(id) || !validVoter(voter) || ![-1, 0, 1].includes(value)) throw new LibraryError("Nie udało się odczytać głosu.", 400);
    const exists = await this.db.prepare("SELECT id FROM recipes WHERE id = ? AND locale = ? AND ready = 1").bind(id, this.locale).first();
    if (!exists) throw new LibraryError("Ten przepis nie jest jeszcze zapisany w bibliotece.", 404);
    if (value === 0) await this.db.prepare("DELETE FROM recipe_votes WHERE recipe_id = ? AND voter = ? AND locale = ?").bind(id, voter, this.locale).run();
    else await this.db.prepare(`INSERT INTO recipe_votes (recipe_id, voter, value, locale) VALUES (?, ?, ?, ?)
      ON CONFLICT(recipe_id, locale, voter) DO UPDATE SET value = excluded.value`).bind(id, voter, value, this.locale).run();
    return this.votes(id, voter);
  }

  async acquire(videoId: string, voter: string) {
    const now = Date.now();
    const id = crypto.randomUUID();
    const result = await this.db.batch([
      this.db.prepare("DELETE FROM generation_leases WHERE expires_at < ?").bind(now),
      this.db.prepare("DELETE FROM generation_attempts WHERE created_at < ?").bind(now - 3600000),
      this.db.prepare(`INSERT OR IGNORE INTO generation_leases (id, video_id, expires_at)
        SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM generation_leases) < 2
        AND (SELECT COUNT(*) FROM generation_attempts WHERE voter = ?) < 6`)
        .bind(id, `${this.locale}:${videoId}`, now + 180000, voter),
      this.db.prepare(`INSERT INTO generation_attempts (id, voter, created_at)
        SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM generation_leases WHERE id = ?)`)
        .bind(id, voter, now, id),
    ]);
    if (!result[2].meta.changes) throw new LibraryError("Osiągnięto chwilowy limit albo ten film jest już analizowany. Spróbuj ponownie za kilka minut.", 429);
    return id;
  }
  async release(id: string) { await this.db.prepare("DELETE FROM generation_leases WHERE id = ?").bind(id).run(); }
}

export function getLibrary(locale: AppLocale = "pl") {
  const env = getCloudflare();
  return env?.DB && env.RECIPES ? new RecipeLibrary(env.DB, env.RECIPES, locale) : null;
}
