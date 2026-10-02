import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostingConfigPath } from '../scripts/hosting-config.mjs';

test('fresh clones have a usable hosting template without project metadata', () => {
  const template = new URL('../.openai/hosting.example.json', import.meta.url);
  const config = JSON.parse(readFileSync(template, 'utf8'));
  assert.deepEqual(config, { d1: null, r2: null });
});

test('local hosting configuration takes precedence over the template', t => {
  const root = mkdtempSync(join(tmpdir(), 'cooking-tube-hosting-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.openai'));
  const template = join(root, '.openai', 'hosting.example.json');
  const local = join(root, '.openai', 'hosting.json');
  writeFileSync(template, JSON.stringify({ d1: null, r2: null }));
  assert.equal(hostingConfigPath(root), template);
  writeFileSync(local, JSON.stringify({ d1: 'DB', r2: null }));
  assert.equal(hostingConfigPath(root), local);
  assert.equal(JSON.parse(readFileSync(hostingConfigPath(root), 'utf8')).d1, 'DB');
});
