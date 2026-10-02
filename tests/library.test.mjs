import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { RecipeLibrary, LibraryError } from '../lib/library.server.ts';
import { runWithCloudflare } from '../lib/cloudflare-context.ts';
import { POST as voteRoute } from '../app/api/vote/route.ts';
import { GET as libraryRoute } from '../app/api/library/route.ts';

// Real SQLite executes the migration and atomic quota/vote constraints. Only the
// transport to D1 and R2 is substituted; upload failures are injected explicitly.
function setup(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_recipe_library.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() { return statement.get(...params) ?? null; },
        async all() { return { results: statement.all(...params) }; },
        async run() { return { meta: { changes: statement.run(...params).changes } }; },
      };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const objects = new Map();
  const bucket = {
    fail: false,
    async put(key, body) { if (this.fail) throw new Error('R2 unavailable'); objects.set(key, body); },
    async get(key) { const body = objects.get(key); return body ? { size: Buffer.byteLength(body), json: async () => JSON.parse(body) } : null; },
  };
  return { sql, db, bucket, objects, library: new RecipeLibrary(db, bucket) };
}
const recipe = id => ({ title: 'Zupa pomidorowa', description: 'Prosta zupa.', time: null, servings: null,
  ingredients: [{ name: 'pomidory', amount: null }], steps: [{ title: 'Gotuj', description: 'Ugotuj pomidory.', at: 10 }],
  notes: [], sourceUrl: `https://www.youtube.com/watch?v=${id}`, author: null });
const id = 'tomatosoup1';
const voter = 'a20a05cb-3333-4444-8888-8101e706ed77';

test('reserves UTF-8 bytes once and stores immutable recipes in R2', async t => {
  const { library, sql, objects } = setup(t);
  await Promise.all([library.save(id, recipe(id)), library.save(id, { ...recipe(id), title: 'Druga wersja' })]);
  assert.equal((await library.get(id)).title, 'Zupa pomidorowa');
  assert.equal(objects.size, 1);
  assert.equal(sql.prepare('SELECT used_bytes FROM recipe_budget').get().used_bytes, Buffer.byteLength(objects.get(`recipes/pl/${id}.json`)));
  assert.equal(sql.prepare('SELECT pending_json, ready FROM recipes').get().pending_json, null);
});
test('atomic capacity limit includes pending uploads and rejects the next object', async t => {
  const { library, sql, objects } = setup(t);
  const bytes = Buffer.byteLength(JSON.stringify(recipe(id)));
  sql.prepare('UPDATE recipe_budget SET limit_bytes = ?').run(bytes);
  await library.save(id, recipe(id));
  await assert.rejects(library.save('tomatosoup2', recipe('tomatosoup2')), error => error instanceof LibraryError && error.status === 507);
  await library.save(id, recipe(id)); // duplicates still work at capacity
  assert.equal(objects.size, 1);
  assert.equal(sql.prepare('SELECT used_bytes FROM recipe_budget').get().used_bytes, bytes);
});
test('a failed upload keeps a durable outbox and recovers without another AI call', async t => {
  const { library, bucket, sql } = setup(t);
  bucket.fail = true;
  await assert.rejects(library.save(id, recipe(id)), /R2 unavailable/);
  assert.equal((await library.list()).recipes.length, 0);
  assert.ok(sql.prepare('SELECT pending_json FROM recipes').get().pending_json);
  const reserved = sql.prepare('SELECT used_bytes FROM recipe_budget').get().used_bytes;
  bucket.fail = false;
  assert.equal((await library.get(id)).title, 'Zupa pomidorowa');
  assert.equal((await library.list()).recipes.length, 1);
  assert.equal(sql.prepare('SELECT used_bytes FROM recipe_budget').get().used_bytes, reserved);
});
test('one browser has one changeable vote; retries do not inflate totals', async t => {
  const { library } = setup(t);
  await library.save(id, recipe(id));
  await Promise.all(Array.from({ length: 10 }, () => library.vote(id, voter, 1)));
  assert.deepEqual(await library.votes(id, voter), { score: 1, myVote: 1 });
  assert.deepEqual(await library.vote(id, voter, -1), { score: -1, myVote: -1 });
  assert.deepEqual(await library.vote(id, voter, 0), { score: 0, myVote: 0 });
  await assert.rejects(library.vote(id, '../../bad', 1), { status: 400 });
  await assert.rejects(library.vote('missing0001', voter, 1), { status: 404 });
});
test('persistent generation leases bound concurrent work and expire after a crash', async t => {
  const { library, sql } = setup(t);
  const a = await library.acquire(id, voter);
  await assert.rejects(library.acquire(id, voter), { status: 429 });
  await library.acquire('tomatosoup2', voter);
  await assert.rejects(library.acquire('tomatosoup3', voter), { status: 429 });
  await library.release(a);
  await library.acquire('tomatosoup3', voter);
  sql.exec('UPDATE generation_leases SET expires_at = 0');
  await library.acquire('tomatosoup4', voter);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM generation_leases').get().count, 1);
});
test('vote API rejects cross-origin requests; library supports shared links', async t => {
  const { library, db, bucket } = setup(t);
  await library.save(id, recipe(id));
  await runWithCloudflare({ DB: db, RECIPES: bucket }, async () => {
    const denied = await voteRoute(new Request('https://cooking.example/api/vote', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value: 1 }) }));
    assert.equal(denied.status, 403);
    const invalid = await voteRoute(new Request('https://cooking.example/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value: 1 }) }));
    assert.equal(invalid.status, 400);
    const response = await libraryRoute(new Request(`https://cooking.example/api/library?id=${id}&lang=pl`));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).recipe.title, 'Zupa pomidorowa');
  });
});

test('PL and EN recipes and votes are separate, but share the same storage budget', async t => {
  const { library, db, bucket, sql, objects } = setup(t);
  const english = new RecipeLibrary(db, bucket, 'en');
  await library.save(id, { ...recipe(id), language: 'pl' });
  assert.equal(await english.get(id), null);
  await english.save(id, { ...recipe(id), language: 'en', title: 'Tomato soup' });
  assert.equal((await library.get(id)).title, 'Zupa pomidorowa');
  assert.equal((await english.get(id)).title, 'Tomato soup');
  assert.equal((await library.list()).recipes.length, 1);
  assert.equal((await english.list()).recipes.length, 1);
  await english.vote(id, voter, 1);
  assert.equal((await library.votes(id, voter)).score, 0);
  assert.equal((await english.votes(id, voter)).score, 1);
  assert.equal(objects.size, 2);
  assert.equal(sql.prepare('SELECT used_bytes FROM recipe_budget').get().used_bytes, [...objects.values()].reduce((sum, body) => sum + Buffer.byteLength(body), 0));
});
