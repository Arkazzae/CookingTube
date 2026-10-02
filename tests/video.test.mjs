import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoId } from '../lib/youtube-url.ts';
import { extractPlayer, parseCaptions, limitedText } from '../lib/video.ts';

test('supports canonical, short and Shorts URLs without forwarding extra parameters', () => {
  for (const url of ['https://www.youtube.com/watch?v=SwDJi_PB-wY&t=10', 'https://youtu.be/SwDJi_PB-wY?si=test', 'https://m.youtube.com/shorts/SwDJi_PB-wY']) assert.equal(parseVideoId(url), 'SwDJi_PB-wY');
});
test('rejects non-YouTube targets, credentials, custom ports and malformed IDs', () => {
  for (const url of ['https://youtube.com.evil.example/watch?v=SwDJi_PB-wY', 'https://youtube.com@evil.example/watch?v=SwDJi_PB-wY', 'https://user@youtube.com/watch?v=SwDJi_PB-wY', 'https://youtube.com:8888/watch?v=SwDJi_PB-wY', 'file:///etc/passwd', 'http://127.0.0.1/', 'https://youtube.com/watch?v=short', 'javascript:alert(1)', 'text']) assert.equal(parseVideoId(url), null, url);
});
test('extracts player JSON with nested braces and escaped quote characters', () => {
  const player = { videoDetails: { title: 'Sauce { cream } with "lemon"', videoId: 'SwDJi_PB-wY' }, more: [1, 2] };
  assert.deepEqual(extractPlayer(`<script>var ytInitialPlayerResponse = ${JSON.stringify(player)}; other();</script>`), player);
  assert.equal(extractPlayer('no player here'), null);
  assert.equal(extractPlayer('ytInitialPlayerResponse = {"x":'), null);
});
test('caption parser preserves numeric times and ignores unusable events', () => {
  assert.deepEqual(parseCaptions(JSON.stringify({ events: [{ tStartMs: 1250, segs: [{ utf8: 'Add ' }, { utf8: '200 g flour\n' }] }, { tStartMs: 2500 }, { segs: [{ utf8: 'missing time' }] }] })), [{ start: 1.25, text: 'Add 200 g flour' }]);
  assert.deepEqual(parseCaptions('<transcript><text start="4.5" dur="1">Salt &amp; pepper &#39;fine&#39;</text></transcript>'), [{ start: 4.5, text: "Salt & pepper 'fine'" }]);
  assert.deepEqual(parseCaptions(''), []);
});
test('oversized upstream and user input is rejected, not buffered indefinitely', async () => {
  assert.equal(await limitedText(new Response('żółć'), 8), 'żółć');
  await assert.rejects(limitedText(new Response('x'.repeat(100)), 10), /too large/);
});

test('caption fetch uses edge-compatible manual redirects and never follows a redirect', async (t) => {
  const { loadVideo, VideoError } = await import('../lib/video.ts');
  const calls = [];
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), redirect: options.redirect });
    return new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/private' } });
  };
  await assert.rejects(loadVideo('SwDJi_PB-wY'), VideoError);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].redirect, 'manual');
  assert.equal(new URL(calls[0].url).hostname, 'www.youtube.com');
});

test('normalizes double-encoded YouTube caption apostrophes', () => {
  assert.deepEqual(parseCaptions('<transcript><text start="1">It&amp;#39;s ready.</text></transcript>'), [{ start: 1, text: "It's ready." }]);
});
