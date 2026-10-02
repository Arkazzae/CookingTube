// Turns the curated videos in data/popular-videos.json into recipes with the same Gemini pipeline the app uses
// (lib/gemini.ts: video assessment, then a Polish recipe) and writes them to lib/popular-recipes.json.
//
//   node --experimental-strip-types scripts/ingest-popular.mjs          # only videos not ingested yet
//   node --experimental-strip-types scripts/ingest-popular.mjs --all    # re-ingest everything
//   --concurrency=1 --pause=60                                           # gentler pacing for free-tier quotas
//   --thumbs-only                                                        # only record which thumbnail sizes exist
//
// Needs GEMINI_API_KEY (read from the environment or .env.local). Each video costs two provider requests.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url);
const input = new URL("data/popular-videos.json", root);
const output = new URL("lib/popular-recipes.json", root);
const categories = ["sniadania", "obiady", "zupy", "wege", "makarony", "azjatyckie", "desery", "wypieki"];

if (existsSync(new URL(".env.local", root))) {
  for (const line of (await readFile(new URL(".env.local", root), "utf8")).split("\n")) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
if (!process.env.GEMINI_API_KEY) { console.error("Set GEMINI_API_KEY (or add it to .env.local)."); process.exit(1); }

const { generateRecipe } = await import("../lib/gemini.ts");
const { recipeResultSchema } = await import("../lib/recipe.ts");

const videos = JSON.parse(await readFile(input, "utf8"));
const previous = existsSync(output) ? JSON.parse(await readFile(output, "utf8")) : [];
const results = new Map(process.argv.includes("--all") ? [] : previous.map(entry => [entry.id, entry]));
const failures = [];
const option = (name, fallback) => Number(process.argv.find(arg => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const concurrency = option("concurrency", 1), pause = option("pause", 30) * 1000;

async function oembed(id) {
  // Confirms the video is public and gives the channel name; the recipe pipeline itself never invents an author.
  const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  if (!response.ok) throw new Error(`oEmbed ${response.status}`);
  const data = await response.json();
  return { videoTitle: String(data.title).slice(0, 300), author: String(data.author_name).slice(0, 200) };
}

async function bestThumb(id) {
  // maxresdefault and hq720 are missing for many videos; storing what exists saves the browser failed requests.
  for (const variant of ["maxresdefault", "hq720", "sddefault"]) {
    const response = await fetch(`https://i.ytimg.com/vi/${id}/${variant}.jpg`, { method: "HEAD" });
    if (response.ok) return variant;
  }
  return "hqdefault";
}

async function ingest(video) {
  if (!/^[\w-]{11}$/.test(video.id) || !categories.includes(video.category)) throw new Error("invalid entry");
  const meta = await oembed(video.id);
  for (let attempt = 1; ; attempt++) {
    try {
      const generated = await generateRecipe(video.id);
      const recipe = recipeResultSchema.parse(generated);
      return { id: video.id, category: video.category, dish: video.dish, ...meta, thumb: await bestThumb(video.id), ingestedAt: new Date().toISOString().slice(0, 10), recipe: { ...recipe, author: meta.author } };
    } catch (error) {
      // Overload and quota errors are temporary; validation failures are final.
      if (attempt >= 4 || ![429, 503].includes(error?.status)) throw error;
      await new Promise(resolve => setTimeout(resolve, (error.status === 429 ? 60000 : 15000) * attempt));
    }
  }
}

for (const entry of results.values()) entry.thumb ??= await bestThumb(entry.id);
const queue = process.argv.includes("--thumbs-only") ? [] : videos.filter(video => !results.has(video.id));
console.log(`Ingesting ${queue.length} of ${videos.length} videos…`);
async function worker() {
  for (let video = queue.shift(); video; video = queue.shift()) {
    const started = Date.now();
    try {
      const entry = await ingest(video);
      results.set(video.id, entry);
      console.log(`✓ ${video.dish} (${video.id}) — ${entry.recipe.ingredients.length} składników, ${entry.recipe.steps.length} kroków, ${Math.round((Date.now() - started) / 1000)} s`);
      await save();
      if (queue.length) await new Promise(resolve => setTimeout(resolve, pause));
    } catch (error) {
      failures.push(video);
      console.log(`✗ ${video.dish} (${video.id}) — ${error instanceof Error ? error.message : error}`);
    }
  }
}
async function save() {
  const ordered = videos.map(video => results.get(video.id)).filter(Boolean);
  await writeFile(output, `${JSON.stringify(ordered, null, 1)}\n`);
}
await Promise.all(Array.from({ length: concurrency }, worker));
await save();
console.log(`Done: ${results.size} recipes saved, ${failures.length} failed.`);
