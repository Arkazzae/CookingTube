export type Recipe = {
  title: string; description: string; servings: string | null; time: string | null;
  ingredients: { name: string; amount: string | null }[];
  steps: { title: string; description: string; at: number | null }[];
  notes: string[]; sourceUrl: string | null; author: string | null; example?: boolean;
};
export const sampleRecipe: Recipe = {
  title: "Makaron cytrynowy z bazylią",
  description: "Kremowy sos, świeża cytryna i garść parmezanu. Prosty pomysł na obiad, który pachnie latem.",
  servings: "2 porcje", time: "20 min", sourceUrl: null, author: null, example: true,
  ingredients: [
    { name: "Makaron", amount: "200 g" }, { name: "Cytryna", amount: "1 szt." },
    { name: "Parmezan, drobno starty", amount: "50 g" }, { name: "Masło", amount: "30 g" },
    { name: "Oliwa", amount: "1 łyżka" }, { name: "Świeża bazylia", amount: "garść" },
    { name: "Sól i czarny pieprz", amount: "do smaku" },
  ],
  steps: [
    { title: "Ugotuj makaron", description: "Zagotuj osoloną wodę i ugotuj makaron al dente, zgodnie z czasem na opakowaniu. Przed odcedzeniem zachowaj kubek wody z gotowania.", at: null },
    { title: "Przygotuj cytrynowy sos", description: "Umyj cytrynę i zetrzyj jej żółtą skórkę. Na dużej patelni rozpuść masło z oliwą. Dodaj skórkę i podgrzewaj przez minutę na małym ogniu.", at: null },
    { title: "Połącz wszystko na patelni", description: "Przełóż makaron na patelnię. Dodaj sok z połowy cytryny i trochę zachowanej wody. Mieszaj, aż sos otuli makaron.", at: null },
    { title: "Dodaj parmezan i podawaj", description: "Zdejmij patelnię z ognia, wsyp parmezan i energicznie wymieszaj. W razie potrzeby dodaj jeszcze trochę wody. Dopraw, posyp bazylią i podawaj od razu.", at: null },
  ],
  notes: ["To przykład wyglądu przepisu, przygotowany na potrzeby podglądu. Nie pochodzi z filmu na YouTube."],
};
import { z } from "zod";

export const recipeResultSchema = z.object({
  title: z.string().min(1).max(200), description: z.string().max(1000),
  servings: z.string().max(100).nullable(), time: z.string().max(100).nullable(),
  ingredients: z.array(z.object({ name: z.string().min(1).max(180), amount: z.string().max(150).nullable() })).min(1).max(60),
  steps: z.array(z.object({ title: z.string().min(1).max(160), description: z.string().min(1).max(1500), at: z.number().nonnegative().finite().nullable() })).min(1).max(30),
  notes: z.array(z.string().max(600)).max(14),
  sourceUrl: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/),
  author: z.string().max(200).nullable(),
});
