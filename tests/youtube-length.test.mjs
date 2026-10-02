import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeLength } from '../lib/youtube-length.ts';

test('reads lengthSeconds from the watch page, even across chunk boundaries', async t => {
  const page = `<html>${'x'.repeat(5000)}"videoDetails":{"videoId":"qYwwBs3yDY0","lengthSeconds":"196","keywords":[]}</html>`;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(String(url), /youtube\.com\/watch\?v=qYwwBs3yDY0/);
    const bytes = new TextEncoder().encode(page);
    return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 700) c.enqueue(bytes.slice(i, i + 700)); c.close(); } }));
  });
  assert.equal(await youtubeLength('qYwwBs3yDY0'), 196);
});

test('returns null when YouTube fails, the value is missing or the ID is invalid', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<html>no player</html>'));
  assert.equal(await youtubeLength('qYwwBs3yDY0'), null);
  fetch.mock.mockImplementation(async () => { throw new Error('blocked'); });
  assert.equal(await youtubeLength('qYwwBs3yDY0'), null);
  assert.equal(await youtubeLength('../etc/passwd'), null);
});
