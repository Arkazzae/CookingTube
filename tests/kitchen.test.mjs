import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientIcon, ingredientIcons } from '../lib/ingredient-icons.ts';
import { findTimers, formatClock } from '../lib/step-timers.ts';
import { plural } from '../lib/plural.ts';

test('maps Polish ingredient names to icons, specific phrases first', () => {
  const cases = {
    'Makaron spaghetti': 'pasta', 'Makaron ryżowy': 'noodles', 'Woda z gotowania makaronu': 'water', 'Sok z cytryny': 'lemon', 'Sok z limonki': 'lime',
    'Oliwa z oliwek': 'oil', 'Czarne oliwki': 'olives', 'Parmezan, drobno starty': 'cheese', 'Ser żółty': 'cheese', 'Ser feta': 'feta', 'Twaróg półtłusty': 'cottage-cheese',
    'Sól i czarny pieprz': 'spices', 'Papryka słodka mielona': 'paprika', 'Płatki chili': 'paprika', 'Papryczka chili': 'chili',
    'Czerwona papryka': 'bell-pepper', 'Czosnek': 'garlic', 'Zielona cebulka': 'spring-onion', 'Cebula': 'onion', 'Por': 'leek', 'Pomidory z puszki': 'tomato',
    'Pierś z kurczaka': 'drumstick', 'Mięso mielone wołowe': 'mince', 'Schab': 'meat', 'Boczek wędzony': 'bacon', 'Biała kiełbasa': 'sausage',
    'Filet z łososia': 'salmon', 'Krewetki': 'shrimp', 'Jajka': 'egg', 'Mąka pszenna': 'flour', 'Mąka ziemniaczana': 'flour', 'Świeża bazylia': 'herbs',
    'Natka pietruszki': 'parsley', 'Pietruszka': 'carrot', 'Koperek': 'dill', 'Masło': 'butter', 'Masło orzechowe': 'peanut', 'Ryż basmati': 'rice',
    'Kasza gryczana': 'rice', 'Pieczarki': 'mushroom', 'Fasola czerwona': 'beans', 'Ciecierzyca': 'chickpeas', 'Ziemniaki': 'potato', 'Orzeszki ziemne': 'peanut',
    'Bulion warzywny': 'stock', 'Miód': 'honey', 'Cukinia': 'zucchini', 'Seler naciowy': 'celery', 'Orzeszki piniowe': 'pine-nuts', 'Pestki dyni': 'seeds',
    'Śmietanka 30%': 'cream', 'Mleko kokosowe': 'cream', 'Mleko': 'milk', 'Jogurt naturalny': 'yogurt', 'Sos sojowy': 'soy-sauce', 'Bułka tarta': 'bread',
    'Cukier': 'sugar', 'Cukier wanilinowy': 'vanilla', 'Drożdże': 'yeast', 'Proszek do pieczenia': 'baking-powder', 'Biszkopty': 'cake', 'Kawa espresso': 'cocoa',
    'Kakao': 'cocoa', 'Gorzka czekolada': 'chocolate', 'Jabłka': 'apple', 'Banany': 'banana', 'Awokado': 'avocado', 'Kapusta kiszona': 'cabbage',
    'Liść laurowy': 'bay-leaf', 'Ziele angielskie': 'peppercorns', 'Cynamon': 'cinnamon', 'Kostki lodu': 'ice', 'Wino białe': 'wine', 'Winogrona': 'grapes',
    'Musztarda': 'mustard', 'Ocet balsamiczny': 'vinegar', 'Tortilla pszenna': 'tortilla', 'Mascarpone': 'cottage-cheese', 'Imbir': 'ginger', 'Coś nowego': 'bowl',
  };
  for (const [name, icon] of Object.entries(cases)) assert.equal(ingredientIcon(name), icon, name);
  const english = { 'Spaghetti': 'pasta', 'Olive oil': 'oil', 'Garlic cloves': 'garlic', 'Whole cloves': 'cloves', 'Salt and black pepper': 'spices', 'Red bell pepper': 'bell-pepper',
    'Chicken breast': 'drumstick', 'Ground beef': 'mince', 'Guanciale': 'bacon', 'Egg yolks': 'egg', 'Cream cheese': 'cottage-cheese', 'Bread flour': 'flour',
    'Ladyfingers': 'cake', 'Lime juice': 'lime', 'Cilantro': 'coriander', 'Ice cream': 'cream', 'Ice cubes': 'ice', 'Rice noodles': 'noodles', 'Burger buns': 'bread' };
  for (const [name, icon] of Object.entries(english)) assert.equal(ingredientIcon(name), icon, name);
  assert.equal(ingredientIcons.length, 125);
});

test('finds explicit durations in Polish steps', () => {
  assert.deepEqual(findTimers('Gotuj makaron 8–10 minut, potem odcedź.').map(t => t.seconds), [480]);
  assert.deepEqual(findTimers('Piecz pół godziny w 180°C.').map(t => t.seconds), [1800]);
  assert.deepEqual(findTimers('Smaż przez minutę, dodaj czosnek i duś 5 min.').map(t => t.seconds), [60, 300]);
  assert.deepEqual(findTimers('Gotuj dziesięć minut.').map(t => t.label), ['10 min']);
  assert.deepEqual(findTimers('Odstaw na 2 h.').map(t => t.seconds), [7200]);
  assert.deepEqual(findTimers('Wsyp 200 g mąki i 2 szklanki mleka, piecz w 180 stopniach.'), []);
  assert.deepEqual(findTimers('Mieszaj przez kilka minut.'), []);
  assert.deepEqual(findTimers('Boil the pasta for 8 to 10 minutes, then rest for half an hour.').map(t => t.seconds), [480, 1800]);
  assert.deepEqual(findTimers('Add 2 cups of milk and bake at 180 degrees.'), []);
  assert.equal(formatClock(605), '10:05');
  assert.equal(formatClock(3725), '1:02:05');
});

test('Polish plural forms', () => {
  const forms = ['krok', 'kroki', 'kroków'];
  assert.deepEqual([1, 2, 5, 12, 22, 25].map(n => plural(n, forms)), ['krok', 'kroki', 'kroków', 'kroków', 'kroki', 'kroków']);
});

test('picks a cover category from the recipe title, then from ingredients', async () => {
  const { coverKey, recipeCover } = await import('../lib/recipe-cover.ts');
  const r = (title, ingredients = []) => ({ title, description: '', ingredients: ingredients.map(name => ({ name, amount: null })) });
  const cases = {
    'Klasyczny domowy rosół drobiowy': 'soup', 'Rosół z makaronem': 'soup', 'Domowy żurek na zakwasie': 'soup-white', 'Zupa pomidorowa z ryżem': 'soup-tomato', 'Barszcz czerwony z uszkami': 'soup-red', 'Krem z pieczonej dyni': 'soup-cream',
    'Ramen miso': 'ramen', 'Pierogi ruskie': 'dumplings', 'Spaghetti carbonara': 'pasta', 'Makaron w sosie pomidorowym': 'pasta',
    'Ciasto na pizzę neapolitańską': 'pizza', 'Puszysty sernik': 'cake', 'Szarlotka na kruchym cieście': 'cake', 'Chlebek bananowy': 'bread',
    'Tiramisu': 'dessert', 'Szakszuka': 'eggs', 'Naleśniki z serem': 'crepes', 'Puszyste pancakes': 'pancakes', 'Tradycyjne placki ziemniaczane': 'fritters',
    'Kotlet schabowy': 'meat', 'Bigos staropolski': 'stew', 'Gołąbki w sosie pomidorowym': 'cabbage-rolls', 'Kurczak curry': 'curry',
    'Guacamole': 'dip', 'Smash burger': 'burger', 'Sałatka grecka': 'salad', 'Łosoś z pieca': 'fish', 'Szaszłyki z grilla': 'grill',
    'Koktajl truskawkowy': 'drinks', 'Classic Carbonara': 'pasta', 'Banana Bread': 'bread', 'Miso Ramen': 'ramen', 'Chicken Curry': 'curry',
    'Smashed Cheeseburger': 'burger', 'Classic Tiramisu': 'dessert', 'Shakshuka': 'eggs', 'Beef stew': 'stew', 'Apple pie': 'cake', 'Greek salad': 'salad', 'Risotto z grzybami': 'rice', 'Tacos z wołowiną': 'tacos', 'Pieczony kurczak': 'poultry',
  };
  for (const [title, key] of Object.entries(cases)) assert.equal(coverKey(r(title)), key, title);
  assert.equal(coverKey(r('Obiad babci', ['Filet z dorsza', 'Ziemniaki'])), 'fish');
  assert.equal(coverKey(r('Coś na szybko', ['Woda'])), 'kitchen');
  const a = recipeCover(r('Rosół'), 'RbfKeQG_3dQ'), b = recipeCover(r('Rosół'), 'RbfKeQG_3dQ');
  assert.deepEqual(a, b);
  assert.match(a.src, /^\/images\/covers\/[a-z-]+\.webp$/);
});
