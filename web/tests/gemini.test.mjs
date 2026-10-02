import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecipe, readGeminiOutput } from '../lib/gemini.ts';
import { formatVideoRecipe } from '../lib/recipe-format.ts';
import { recipeResultSchema } from '../lib/recipe.ts';
import { POST } from '../app/api/recipe/route.ts';

process.env.GEMINI_API_KEY = 'test-only-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash';
const output = { isRecipe: true, title: 'Makaron', description: 'Makaron z cytryną.',
  servings: null, servingsEvidence: '', time: '15 minut', timeEvidence: '',
  ingredients: [{ name: 'makaron', amount: '200 g', evidence: '200 grams of pasta' }, { name: 'cytryna', amount: '2 sztuki', evidence: '' }],
  steps: [{ title: 'Połącz składniki', description: 'Dodaj sok z cytryny do makaronu.', at: 42 }], notes: [] };
const interaction = value => ({ status: 'completed', steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] }] });
const request = (url, options = {}) => new Request('https://cooking-tube.example/api/recipe', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://cooking-tube.example' }, body: JSON.stringify({ url }), ...options,
});

test('sends the canonical public video directly to Gemini with server-only authentication', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(init.headers['x-goog-api-key'], 'test-only-key');
    assert.equal(init.redirect, 'manual');
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.model, 'gemini-3.5-flash');
    assert.deepEqual(body.input[0], { type: 'video', uri: 'https://www.youtube.com/watch?v=SwDJi_PB-wY' });
    assert.equal(body.response_format.mime_type, 'application/json');
    assert.equal(init.body.includes('test-only-key'), false);
    return Response.json(interaction(output));
  });
  const recipe = await generateRecipe('SwDJi_PB-wY');
  assert.equal(recipeResultSchema.safeParse(recipe).success, true);
  assert.equal(recipe.ingredients[0].amount, '200 g');
  assert.equal(recipe.ingredients[1].amount, null);
  assert.equal(recipe.time, null);
  assert.equal(recipe.steps[0].at, null);
});

test('rejects unsafe video IDs before contacting a provider', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  await assert.rejects(generateRecipe('../../secret'), { status: 400 });
  assert.equal(fetch.mock.callCount(), 0);
});

test('does not turn incomplete output or non-recipe videos into a recipe', () => {
  assert.throws(() => readGeminiOutput({ status: 'in_progress', steps: interaction(output).steps }));
  assert.throws(() => readGeminiOutput({ status: 'completed', steps: [{ type: 'thought' }] }));
  assert.throws(() => formatVideoRecipe(JSON.stringify({ ...output, isRecipe: false }), 'SwDJi_PB-wY'), /Nie znaleźliśmy/);
  assert.throws(() => formatVideoRecipe('not JSON', 'SwDJi_PB-wY'));
});

test('normalizes links and reuses completed recipes without another provider call', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(interaction(output)));
  const response = await POST(request('https://youtu.be/testvideo01?si=tracking'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).recipe.sourceUrl, 'https://www.youtube.com/watch?v=testvideo01');
  assert.equal((await POST(request('https://www.youtube.com/watch?v=testvideo01'))).status, 200);
  assert.equal(fetch.mock.callCount(), 1);
});

test('rejects cross-origin, malformed, oversized and non-YouTube requests', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  assert.equal((await POST(request('https://youtube.com/watch?v=SwDJi_PB-wY', { headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' } }))).status, 403);
  assert.equal((await POST(request('https://127.0.0.1/private'))).status, 400);
  assert.equal((await POST(request('', { body: '{broken' }))).status, 400);
  assert.equal((await POST(request('x'.repeat(5000)))).status, 400);
  assert.equal((await POST(request('', { headers: { 'Content-Type': 'text/plain' } }))).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

test('returns friendly provider errors without exposing provider bodies or credentials', async t => {
  for (const [upstream, expected] of [[400, 422], [401, 503], [403, 503], [429, 429], [503, 503], [500, 502]]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('debug test-only-key upstream internal detail', { status: upstream }));
    const response = await POST(request('https://youtu.be/testvideo02'));
    assert.equal(response.status, expected);
    const body = await response.text();
    assert.doesNotMatch(body, /test-only-key|upstream|internal detail/);
    if (expected === 429) assert.equal(response.headers.get('Retry-After'), '60');
    fetch.mock.restore();
  }
});

test('validates the browser origin against the public Host rather than an internal Next hostname', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Host: '127.0.0.1:5173', Origin: 'http://127.0.0.1:5173' }, body: '{"url":"invalid"}' };
  const response = await POST(new Request('http://localhost:5173/api/recipe', options));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Wklej prawidłowy link do filmu z YouTube.');
  options.headers.Origin = 'http://other.example';
  assert.equal((await POST(new Request('http://localhost:5173/api/recipe', options))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
});

test('passes cancellation through to Gemini', async t => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    assert.equal(signal.aborted, true);
    throw signal.reason;
  });
  await assert.rejects(generateRecipe('SwDJi_PB-wY', controller.signal), { name: 'AbortError' });
});

test('bounds concurrent provider work and releases slots after failures', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 2) ready();
    await gate;
    return new Response('', { status: 503 });
  });
  const pending = [POST(request('https://youtu.be/testvideo03')), POST(request('https://youtu.be/testvideo04'))];
  await started;
  assert.equal((await POST(request('https://youtu.be/testvideo05'))).status, 429);
  release();
  assert.deepEqual((await Promise.all(pending)).map(r => r.status), [503, 503]);
  assert.equal((await POST(request('https://youtu.be/testvideo05'))).status, 503);
});
