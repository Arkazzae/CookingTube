import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyLimit, quotaFor, recordGeneration, subjectsFor } from '../lib/daily-limit.ts';

const DAY = 24 * 60 * 60_000;
const voter = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';

test('identifies a person by browser ID and a salted address hash, never the raw address', async () => {
  const request = new Request('https://example.com/api/recipe', { headers: { 'x-voter-id': voter, 'cf-connecting-ip': '203.0.113.7' } });
  const subjects = await subjectsFor(request);
  assert.equal(subjects.length, 2);
  assert.equal(subjects[0], `v:${voter}`);
  assert.match(subjects[1], /^ip:[0-9a-f]{32}$/);
  assert.ok(!subjects.join(' ').includes('203.0.113.7'));
  assert.deepEqual(await subjectsFor(new Request('https://example.com/', { headers: { 'x-voter-id': 'not-a-uuid' } })), []);
});

test('allows five fresh recipes per rolling day and reports when the next one frees up', async () => {
  const subjects = ['v:limit-test', 'ip:limit-test'];
  const start = Date.now();
  assert.equal((await quotaFor(subjects, start)).remaining, 5);
  for (let i = 0; i < 5; i++) await recordGeneration(subjects, start + i * 60_000);
  const full = await quotaFor(subjects, start + 10 * 60_000);
  assert.deepEqual({ remaining: full.remaining, used: full.used }, { remaining: 0, used: 5 });
  assert.equal(full.resetAt, start + DAY);
  // The oldest generation leaves the window after a day.
  assert.equal((await quotaFor(subjects, start + DAY + 1)).remaining, 1);
});

test('the stricter subject wins, so a new browser on the same address is still limited', async () => {
  for (let i = 0; i < 5; i++) await recordGeneration(['ip:shared-address'], Date.now());
  assert.equal((await quotaFor(['v:fresh-browser', 'ip:shared-address'])).remaining, 0);
});

test('DAILY_RECIPE_LIMIT configures the limit; 0 switches it off', async () => {
  process.env.DAILY_RECIPE_LIMIT = '0';
  assert.equal(dailyLimit(), 0);
  assert.equal((await quotaFor(['v:anyone'])).limit, 0);
  process.env.DAILY_RECIPE_LIMIT = '12';
  assert.equal(dailyLimit(), 12);
  delete process.env.DAILY_RECIPE_LIMIT;
  assert.equal(dailyLimit(), 5);
});
