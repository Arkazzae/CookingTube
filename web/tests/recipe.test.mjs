import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecipeInput, formatRecipe, sourceSchema } from '../lib/recipe-format.ts';

const source = { id: 'SwDJi_PB-wY', title: 'Pasta', author: 'Cook', description: '', segments: [{ start: 12.25, text: 'Add 200 g pasta to the boiling water.' }, { start: 18, text: 'Stir and add lemon juice.' }] };
const generated = { isRecipe: true, title: 'Makaron z cytryną', description: 'Krótki przepis.', time: null, timeEvidence: "", servings: null, servingsEvidence: "", ingredients: [{ name: 'makaron', amount: '200 g', evidence: '200 g pasta' }, { name: 'sok z cytryny', amount: '100 ml', evidence: '100 ml lemon juice' }], steps: [{ title: 'Ugotuj makaron', description: 'Wrzuć makaron do wrzątku.', at: 12.25 }, { title: 'Dodaj sok', description: 'Wymieszaj z sokiem.', at: 99 }], notes: [] };

test('keeps grounded quantities and timestamps, removes invented ones', () => {
  const recipe = formatRecipe(JSON.stringify(generated), source);
  assert.equal(recipe.ingredients[0].amount, '200 g');
  assert.equal(recipe.ingredients[1].amount, null);
  assert.equal(recipe.steps[0].at, 12.25);
  assert.equal(recipe.steps[1].at, null);
  assert.equal(recipe.sourceUrl, 'https://www.youtube.com/watch?v=SwDJi_PB-wY');
  assert.equal(recipe.author, 'Cook');
  assert.match(recipe.notes.join(' '), /nie udało się potwierdzić/);
  assert.equal(recipe.example, undefined);
});
test('rejects malformed output, missing steps and non-recipe material', () => {
  for (const output of ['not json', '{}', JSON.stringify({ ...generated, isRecipe: false }), JSON.stringify({ ...generated, steps: [] })]) {
    assert.throws(() => formatRecipe(output, source));
  }
});
test('description-only recipes disclose their source and have no timestamps', () => {
  const recipe = formatRecipe(JSON.stringify(generated), { ...source, description: '200 g pasta', segments: [] });
  assert.match(recipe.notes[0], /na podstawie opisu/);
  assert.ok(recipe.steps.every(step => step.at === null));
});
test('bounds complete source without dropping the final instruction', () => {
  const input = buildRecipeInput(source);
  assert.match(input, /Stir and add lemon juice/);
  assert.throws(() => buildRecipeInput({ ...source, description: 'x'.repeat(14001) }), /za długi/);
  assert.throws(() => buildRecipeInput({ ...source, segments: [] }), /zabrakło treści/);
  assert.equal(sourceSchema.safeParse({ ...source, id: '../../private' }).success, false);
});

test('accepts WebLLM disabled-thinking prefix but rejects free-form reasoning', () => {
  assert.equal(formatRecipe(`<think>\n\n</think>\n\n${JSON.stringify(generated)}`, source).title, generated.title);
  assert.throws(() => formatRecipe(`<think>made up reasoning</think>${JSON.stringify(generated)}`, source));
});

test('does not display invented total time or serving count', () => {
  const recipe = formatRecipe(JSON.stringify({ ...generated, servings: '4 porcje', servingsEvidence: 'serves 4', time: '30 minut', timeEvidence: '30 minutes' }), source);
  assert.equal(recipe.servings, null);
  assert.equal(recipe.time, null);
});

test('treats omitted optional metadata as unknown without accepting ungrounded amounts', () => {
  const recipe = formatRecipe(JSON.stringify({ isRecipe: true, title: 'Makaron', description: 'Z cytryną.',
    ingredients: [{ name: 'makaron', amount: '200 g' }, { name: 'cytryna' }],
    steps: [{ title: 'Wymieszaj', description: 'Dodaj sok z cytryny.' }] }), source);
  assert.equal(recipe.time, null);
  assert.equal(recipe.servings, null);
  assert.ok(recipe.ingredients.every(ingredient => ingredient.amount === null));
  assert.equal(recipe.steps[0].at, null);
  assert.match(recipe.notes.join(' '), /nie udało się potwierdzić/);
});

test('rejects a model stuck repeating the same ingredient', () => {
  assert.throws(() => formatRecipe(JSON.stringify({ ...generated, ingredients: Array(10).fill(generated.ingredients[0]) }), source), /spójnego/);
});
