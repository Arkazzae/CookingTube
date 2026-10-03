import type { Recipe } from "@/lib/recipe";
import type { Dictionary } from "@/lib/i18n";
import { recipeCover } from "@/lib/recipe-cover";
import { ingredientIconIndex } from "@/lib/ingredient-icons";

export type ImageFormat = "post" | "story";
const sizes = { post: { w: 1080, h: 1350, photo: 720, ingredients: 8 }, story: { w: 1080, h: 1920, photo: 1040, ingredients: 12 } };
const C = { bg: "#0a0f0b", surface: "#152017", text: "#eef3ea", text2: "#b6c1b2", text3: "#8a9686", accent: "#8fdf6a", ink: "#0c1a07", gold: "#f2c14e" };
const LEAF = "M13 51C13 27 27 13 51 13c0 24-14 38-38 38Z", PLAY = "M28 25.5v13l11-6.5Z";
// Design House mark (designhouse.me): [x, y, side] of its three squares in a 150.3-wide box.
const DH_SQUARES = [[73.18, 0, 31.73], [0, 31.82, 73.39], [104.8, 31.81, 45.5]] as const;

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image failed: ${src}`));
    image.src = src;
  });
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const words = text.split(/\s+/), lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > width && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}
function ellipsis(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}
function brand(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = C.accent; ctx.fill(new Path2D(LEAF));
  ctx.fillStyle = C.bg; ctx.fill(new Path2D(PLAY));
  ctx.strokeStyle = C.bg; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.stroke(new Path2D("M13 51l7-7"));
  ctx.restore();
}

function designHouseMark(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  const s = width / 150.3;
  ctx.fillStyle = "#e6ff32";
  for (const [sx, sy, side] of DH_SQUARES) { roundRect(ctx, x + sx * s, y + sy * s, side * s, side * s, 5.88 * s); ctx.fill(); }
}

/** Draws a shareable recipe card (Instagram post or story) in the app's art direction. */
export async function renderRecipeImage({ recipe, id, format, t, url }: { recipe: Recipe; id: string; format: ImageFormat; t: Dictionary; url: string }) {
  const size = sizes[format];
  const cover = recipeCover(recipe, id);
  const sample = `${recipe.title} ${recipe.ingredients.map(i => i.name).join(" ")} ąćęłńóśźż`;
  await Promise.all([
    document.fonts.load('700 80px "Bricolage Grotesque"', sample), document.fonts.load('600 30px "Onest"', sample),
    document.fonts.load('400 30px "Onest"', sample),
  ]);
  const [photo, sprite] = await Promise.all([load(cover.src), load("/icons/ingredients-125.webp")]);
  const canvas = document.createElement("canvas");
  canvas.width = size.w; canvas.height = size.h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, size.w, size.h);

  // Photo, cropped to cover the top area, with the same mirroring as in the app.
  const scale = Math.max(size.w / photo.width, size.photo / photo.height);
  const dw = photo.width * scale, dh = photo.height * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, size.w, size.photo); ctx.clip();
  if (cover.mirrored) { ctx.translate(size.w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(photo, (size.w - dw) / 2, (size.photo - dh) / 2, dw, dh);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 0, 0, size.photo);
  fade.addColorStop(0, "rgba(10,15,11,.55)"); fade.addColorStop(.2, "rgba(10,15,11,0)"); fade.addColorStop(.55, "rgba(10,15,11,.1)"); fade.addColorStop(1, C.bg);
  ctx.fillStyle = fade; ctx.fillRect(0, 0, size.w, size.photo + 2);

  const pad = 72;
  brand(ctx, pad - 6, 52, 0.9);
  ctx.fillStyle = C.text; ctx.font = '700 40px "Bricolage Grotesque"'; ctx.textBaseline = "alphabetic";
  ctx.fillText("Cooking", pad + 58, 96);
  ctx.fillStyle = C.accent; ctx.fillText("Tube", pad + 58 + ctx.measureText("Cooking").width, 96);

  // Category badge and title sit on the lower part of the photo.
  ctx.font = '700 80px "Bricolage Grotesque"';
  const titleLines = wrap(ctx, recipe.title, size.w - pad * 2, 3);
  let y = size.photo - 40 - (titleLines.length - 1) * 84;
  const label = t.covers[cover.key].toUpperCase();
  ctx.font = '700 24px "Onest"';
  const badgeW = ctx.measureText(label).width + 36;
  ctx.fillStyle = "rgba(242,193,78,.16)"; roundRect(ctx, pad, y - 112, badgeW, 44, 12); ctx.fill();
  ctx.fillStyle = C.gold; ctx.fillText(label, pad + 18, y - 81);
  ctx.fillStyle = C.text; ctx.font = '700 80px "Bricolage Grotesque"';
  for (const line of titleLines) { ctx.fillText(line, pad, y); y += 84; }

  y -= 30;
  if (recipe.author) {
    ctx.font = '400 30px "Onest"'; ctx.fillStyle = C.text2;
    ctx.fillText(ellipsis(ctx, `${t.recipe.fromVideo} ${recipe.author}`, size.w - pad * 2), pad, y + 26);
    y += 52;
  }

  // Stat chips.
  y += 18;
  const chips = [recipe.time, recipe.servings, t.count.ingredients(recipe.ingredients.length), t.count.steps(recipe.steps.length)].filter(Boolean) as string[];
  let x = pad;
  ctx.font = '600 28px "Onest"';
  for (const chip of chips) {
    const w = ctx.measureText(chip).width + 44;
    if (x + w > size.w - pad) break;
    ctx.fillStyle = "rgba(143,223,106,.14)"; roundRect(ctx, x, y, w, 56, 28); ctx.fill();
    ctx.fillStyle = C.accent; ctx.fillText(chip, x + 22, y + 38);
    x += w + 12;
  }
  y += 56 + 46;

  // Ingredients in two columns with the generated icons.
  const footer = size.h - 132;
  ctx.fillStyle = C.text; ctx.font = '700 36px "Bricolage Grotesque"';
  ctx.fillText(t.card2.ingredients, pad, y); y += 26;
  const rowH = 60, colW = (size.w - pad * 2 - 24) / 2;
  const rows = Math.max(0, Math.min(Math.ceil(size.ingredients / 2), Math.floor((footer - y - 20) / rowH)));
  const shown = recipe.ingredients.slice(0, rows * 2);
  ctx.font = '400 28px "Onest"';
  shown.forEach((ingredient, i) => {
    const cx = pad + (i % 2) * (colW + 24), cy = y + Math.floor(i / 2) * rowH;
    ctx.fillStyle = C.surface; roundRect(ctx, cx, cy + 6, 46, 46, 13); ctx.fill();
    const index = ingredientIconIndex(ingredient.name);
    ctx.drawImage(sprite, (index % 5) * 72, Math.floor(index / 5) * 72, 72, 72, cx + 7, cy + 13, 32, 32);
    ctx.fillStyle = C.text;
    const amount = ingredient.amount ? ` · ${ingredient.amount}` : "";
    ctx.fillText(ellipsis(ctx, `${ingredient.name}${amount}`, colW - 64), cx + 60, cy + 39);
  });
  if (recipe.ingredients.length > shown.length && shown.length) {
    ctx.fillStyle = C.text3; ctx.font = '400 26px "Onest"';
    ctx.fillText(`+ ${recipe.ingredients.length - shown.length}`, pad, y + rows * rowH + 26);
  }

  // Footer: where the recipe lives.
  ctx.strokeStyle = "rgba(214,255,220,.12)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, footer); ctx.lineTo(size.w - pad, footer); ctx.stroke();
  ctx.fillStyle = C.text3; ctx.font = '400 26px "Onest"';
  ctx.fillText(t.card2.made, pad, footer + 50);
  ctx.fillStyle = C.accent; ctx.font = '600 26px "Onest"';
  const host = url.replace(/^https?:\/\//, "");
  ctx.fillText(ellipsis(ctx, host, size.w / 2), size.w - pad - Math.min(ctx.measureText(host).width, size.w / 2), footer + 50);
  // Second line: the studio that built the app.
  ctx.fillStyle = C.text3; ctx.font = '400 24px "Onest"';
  const by = t.shell.builtBy;
  let bx = pad + ctx.measureText(by).width + 12;
  ctx.fillText(by, pad, footer + 90);
  designHouseMark(ctx, bx, footer + 71, 28);
  bx += 28 + 9;
  ctx.fillStyle = C.text2; ctx.font = '600 24px "Onest"';
  ctx.fillText("Design House", bx, footer + 90);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas export failed")), "image/jpeg", 0.9));
}
