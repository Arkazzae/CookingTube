import test from 'node:test';
import assert from 'node:assert/strict';
import { localeFromLanguage, requestLocale } from '../lib/locale.ts';
import { POST } from '../app/api/recipe/route.ts';

test('uses Polish for Polish locales and English for other preferred locales', () => {
  for (const value of ['pl', 'pl-PL', 'PL-pl', 'pl-PL,pl;q=0.9,en;q=0.8']) assert.equal(localeFromLanguage(value), 'pl');
  for (const value of ['en', 'en-GB', 'de-DE,pl;q=0.8', '', undefined]) assert.equal(localeFromLanguage(value), 'en');
  assert.equal(requestLocale(new Request('https://cooking.example/api/library?lang=pl', { headers: { 'Accept-Language': 'en-US' } })), 'pl');
  assert.equal(requestLocale(new Request('https://cooking.example/api/library', { headers: { 'x-app-locale': 'en', 'Accept-Language': 'pl' } })), 'en');
});
test('API failures are returned in the browser language', async () => {
  for (const [language, expected] of [['en-US', 'Paste a valid YouTube video link.'], ['pl-PL', 'Wklej prawidłowy link do filmu z YouTube.']]) {
    const response = await POST(new Request('https://cooking.example/api/recipe', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': language }, body: JSON.stringify({ url: 'invalid' }),
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, expected);
  }
});
