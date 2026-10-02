import type { Recipe } from "./recipe";
import { ingredientIcon } from "./ingredient-icons.ts";

// Cover photos generated with Codex in one art direction (public/images/covers). YouTube thumbnails vary too much
// in style and often carry large text, so cards and recipe heroes use the dish category's cover instead.
export const covers = {
  ramen: { label: "Ramen i zupy azjatyckie", images: ["ramen"] },
  "soup-cream": { label: "Zupy krem", images: ["soup-cream"] },
  "soup-white": { label: "Żurek i białe zupy", images: ["zurek"] },
  "soup-tomato": { label: "Pomidorowa", images: ["tomato-soup"] },
  "soup-red": { label: "Barszcz", images: ["borscht"] },
  soup: { label: "Zupy", images: ["broth"] },
  dumplings: { label: "Pierogi i kluski", images: ["pierogi"] },
  pizza: { label: "Pizza", images: ["pizza"] },
  burger: { label: "Burgery i kanapki", images: ["burger"] },
  tacos: { label: "Kuchnia meksykańska", images: ["tacos"] },
  curry: { label: "Curry", images: ["curry"] },
  crepes: { label: "Naleśniki", images: ["crepes"] },
  pancakes: { label: "Placuszki i gofry", images: ["pancakes"] },
  fritters: { label: "Placki", images: ["fritters"] },
  eggs: { label: "Jajka i śniadania", images: ["eggs"] },
  cake: { label: "Ciasta", images: ["cake"] },
  bread: { label: "Pieczywo i wypieki", images: ["bread"] },
  dessert: { label: "Desery", images: ["dessert"] },
  drinks: { label: "Napoje i koktajle", images: ["drinks"] },
  pasta: { label: "Makarony", images: ["pasta", "pasta-lemon"] },
  asian: { label: "Kuchnia azjatycka", images: ["stir-fry"] },
  rice: { label: "Ryż i kasze", images: ["risotto"] },
  dip: { label: "Przekąski i dipy", images: ["dip"] },
  salad: { label: "Sałatki", images: ["salad"] },
  grill: { label: "Grill", images: ["grill"] },
  fish: { label: "Ryby i owoce morza", images: ["fish"] },
  "cabbage-rolls": { label: "Gołąbki", images: ["golabki"] },
  stew: { label: "Gulasze i dania jednogarnkowe", images: ["stew"] },
  poultry: { label: "Drób", images: ["poultry"] },
  meat: { label: "Mięsa", images: ["cutlet"] },
  vege: { label: "Wege", images: ["vege"] },
  kitchen: { label: "Przepis", images: ["kitchen"] },
} as const;
export type CoverKey = keyof typeof covers;

// Matched against the recipe title first. Specific dishes come before broad families,
// so "Rosół z makaronem" is a soup and "Ciasto na pizzę" is pizza.
const rules: [CoverKey, RegExp][] = [
  ["ramen", /ramen|(^|\s)pho(\s|$)|udon|zupa miso|laksa|noodle soup/],
  ["soup-cream", /(^|\s)krem (z|ze|dyniow|pomidorow|brokułow|z dyni)|zupa[- ]krem|cream of|creamy (pumpkin|tomato|mushroom|broccoli)? ?soup|bisque/],
  ["soup-white", /(^|\s)żur|biały barszcz|barszcz biały|sour rye/],
  ["soup-tomato", /zupa pomidorow|(^|\s)pomidorówk|(^|\s)pomidorowa(\s|$)|tomato soup/],
  ["soup-red", /barszcz|borscht|borsz/],
  ["soup", /zup|rosół|rosoł|(^|\s)żur|barszcz|krupnik|chłodnik|grochówk|kapuśniak|bulion|flaki|soup|broth|chowder|minestrone/],
  ["dumplings", /pierog|uszka|uszek|kopytk|knedl|gnocch|raviol|pielmien|klusk|pyzy|gyoz|dumpling|ravioli/],
  ["pizza", /pizz|calzone/],
  ["burger", /burger|hot[- ]?dog|kanapk|sandwich|zapiekank|(^|\s)tost|sandwich|toastie/],
  ["tacos", /taco|burrito|quesadill|fajit|nachos|enchilad|tortill|wrap|meksyk/],
  ["curry", /curry|tikka|masala|(^|\s)dal(\s|$)|korma|vindaloo|biryani/],
  ["crepes", /naleśnik|crep|crêpe/],
  ["pancakes", /pancake|racuch|gofr|placuszk|waffle|hotcake/],
  ["fritters", /placki|placek|latk|rösti|frytk|fritter|hash brown|latke/],
  ["eggs", /szakszuk|shakshuk|jajecznic|omlet|frittat|(^|\s)jaj|(^|\s)eggs?(\s|$)|omelet|scrambled|benedict/],
  ["cake", /sernik|szarlotk|jabłecznik|(^|\s)tort|brownie|piernik|makowiec|(^|\s)babk|(^|\s)tart[ay]?(\s|$)|ciast|keks|murzynek|cheesecake|muffin|babeczk|cookie|cake|(^|\s)pie(\s|$)|(^|\s)tarts?(\s|$)|cookie|cupcake|cheesecake/],
  ["bread", /chleb|bułk|focacc|bagiet|drożdżówk|rogal|croissant|pieczyw|(^|\s)pita|naan|bajgl|bread|loaf|bun(s)?(\s|$)|bagel|roll(s)?(\s|$)|scone/],
  ["dessert", /tiramisu|deser|(^|\s)mus(\s|$)|panna cotta|(^|\s)lody|budyń|crème|creme|pudding|w szklance|kisiel|galaretk|sorbet|dessert|mousse|ice cream|parfait|trifle/],
  ["drinks", /koktajl|smoothie|lemoniad|napój|shake|latte|kakao|herbat|(^|\s)kaw[aęy]|drink|cocktail|lemonade|smoothie|juice|drink/],
  ["pasta", /makaron|spaghett|carbonar|penne|lasagn|tagliatell|fettuccin|bolognes|aglio|(^|\s)pasta(\s|$)|rigaton|fusill|linguin|pasta|mac and cheese|macaroni|gnocchi/],
  ["asian", /stir|(^|\s)wok|teriyaki|pad thai|kung pao|sushi|azjat|chińsk|tajsk|japońsk|koreańsk|bibimbap|sajgonk|(^|\s)bao(\s|$)|fried rice|stir-fry|thai|chinese|japanese|korean|vietnamese|dumpling/],
  ["rice", /risotto|paella|ryż|kasz|pilaw|plov|jambalaya|kuskus|quinoa|rice|couscous|grain bowl/],
  ["dip", /guacamol|hummus|(^|\s)dip|kanapkow|tzatziki|salsa|przekąsk|bruschett|pasztet|appetizer|snack|spread/],
  ["salad", /sałat|coleslaw|surówk|cezar|caesar|salad|slaw/],
  ["grill", /grill|szaszł|kebab|barbecue|bbq|z rusztu|grilled|skewer|barbecue/],
  ["cabbage-rolls", /gołąb|cabbage roll/],
  ["fish", /ryb|łoso|dorsz|tuńczyk|krewet|owoce morza|śledź|śledzi|pstrąg|makrel|(^|\s)mul|małż|kalmar|sandacz|fish|salmon|cod|tuna|shrimp|prawn|seafood|mussel/],
  ["stew", /gulasz|bigos|leczo|chili con|potrawk|duszon|jednogarnk|gołąbk|strogonow|(^|\s)ragu|po bretońsku|kociołek|stew|goulash|casserole|chili(\s|$)|braise|pot roast/],
  ["poultry", /kurczak|kurczę|(^|\s)drób|drobiow|indyk|kacz|skrzyde|udk|udzi|(^|\s)pierś|piersi|chicken|turkey|duck|wings/],
  ["meat", /schabow|kotlet|stek|wołow|wieprz|karkówk|żeberk|pieczeń|mielon|klops|zraz|rolad|golonk|polędwic|schab|mięs|beef|pork|steak|schnitzel|meatball|lamb|ribs|roast|cutlet|chop/],
  ["vege", /wege|wegań|tofu|ciecierzyc|falafel|(^|\s)bowl|warzyw|soczewic|bakłażan|cukini|kalafior|brokuł|vegan|vegetarian|veggie|tofu|lentil|chickpea|falafel/],
];

const fromIngredients = (recipe: Pick<Recipe, "ingredients">): CoverKey => {
  const icons = new Set(recipe.ingredients.map(i => ingredientIcon(i.name)));
  const has = (...names: string[]) => names.some(name => icons.has(name as never));
  if (has("fish", "salmon", "tuna", "shrimp")) return "fish";
  if (has("pasta", "noodles")) return "pasta";
  if (has("drumstick")) return "poultry";
  if (has("meat", "mince", "bacon", "sausage", "ham")) return "meat";
  if (has("flour") && has("sugar")) return "cake";
  if (has("rice")) return "rice";
  if (has("egg")) return "eggs";
  return "kitchen";
};

export function coverKey(recipe: Pick<Recipe, "title" | "description" | "ingredients">): CoverKey {
  const match = (text: string) => rules.find(([, pattern]) => pattern.test(text.normalize("NFC").toLowerCase()))?.[0];
  return match(recipe.title) ?? fromIngredients(recipe);
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Picks the category cover and a stable framing per recipe, so dishes from one category still look different. */
export function recipeCover(recipe: Pick<Recipe, "title" | "description" | "ingredients">, seed: string) {
  const key = coverKey(recipe);
  const { images, label } = covers[key];
  const h = hash(seed);
  return {
    key, label,
    src: `/images/covers/${images[h % images.length]}.webp`,
    position: ["50% 50%", "38% 45%", "62% 55%", "50% 35%"][(h >> 3) % 4],
    mirrored: ((h >> 6) & 1) === 1,
  };
}
