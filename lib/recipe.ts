export type Recipe = {
  language?: "pl" | "en";
  title: string; description: string; servings: string | null; time: string | null;
  ingredients: { name: string; amount: string | null }[];
  steps: { title: string; description: string; at: number | null }[];
  notes: string[]; sourceUrl: string | null; author: string | null; example?: boolean;
};
import { z } from "zod";

export const recipeResultSchema = z.object({
  language: z.enum(["pl", "en"]).optional(),
  title: z.string().min(1).max(200), description: z.string().max(1000),
  servings: z.string().max(100).nullable(), time: z.string().max(100).nullable(),
  ingredients: z.array(z.object({ name: z.string().min(1).max(180), amount: z.string().max(150).nullable() })).min(1).max(60),
  steps: z.array(z.object({ title: z.string().min(1).max(160), description: z.string().min(1).max(1500), at: z.number().nonnegative().finite().nullable() })).min(1).max(30),
  notes: z.array(z.string().max(600)).max(14),
  sourceUrl: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/),
  author: z.string().max(200).nullable(),
});
