"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, FileText, ImageIcon, Link2, Mail, Share, Share2 } from "lucide-react";
import type { Recipe } from "@/lib/recipe";
import { useHydrated } from "@/lib/local-library";
import { recipeCover } from "@/lib/recipe-cover";
import { Sheet } from "./sheet";
import { RecipeImage } from "./media";
import { BrandIcon, type Brand } from "./brand-icons";
import { renderRecipeImage, type ImageFormat } from "./recipe-image";
import { useT } from "./locale";

export function recipeAsText(recipe: Recipe, t: ReturnType<typeof useT>) {
  return [recipe.title, recipe.description, "", `${t.card2.ingredients}:`, ...recipe.ingredients.map(i => `• ${i.name}${i.amount ? ` — ${i.amount}` : ""}`), "",
    `${t.card2.steps}:`, ...recipe.steps.map((s, n) => `${n + 1}. ${s.title}. ${s.description}`), ...(recipe.sourceUrl ? ["", `${t.card2.source}: ${recipe.sourceUrl}`] : [])].join("\n");
}

const networks: { brand: Brand; name: string; href: (url: string, text: string, image: string) => string }[] = [
  { brand: "facebook", name: "Facebook", href: url => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { brand: "x", name: "X", href: (url, text) => `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { brand: "whatsapp", name: "WhatsApp", href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  { brand: "messenger", name: "Messenger", href: url => `fb-messenger://share/?link=${encodeURIComponent(url)}` },
  { brand: "telegram", name: "Telegram", href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { brand: "pinterest", name: "Pinterest", href: (url, text, image) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(text)}` },
  { brand: "threads", name: "Threads", href: (url, text) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}` },
  { brand: "reddit", name: "Reddit", href: (url, text) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
];

export function ShareSheet({ open, onClose, id, recipe }: { open: boolean; onClose: () => void; id: string; recipe: Recipe }) {
  const t = useT();
  const [view, setView] = useState<"share" | "image">("share");
  const close = () => { onClose(); setView("share"); };
  return <Sheet open={open} onClose={close} title={view === "share" ? t.share.title : t.share.image} description={view === "share" ? t.share.description : t.share.imageHint} className="sheet--share">
    {view === "share" ? <ShareOptions id={id} recipe={recipe} onImage={() => setView("image")} /> : <ImageMaker id={id} recipe={recipe} onBack={() => setView("share")} />}
  </Sheet>;
}

function ShareOptions({ id, recipe, onImage }: { id: string; recipe: Recipe; onImage: () => void }) {
  const t = useT();
  const hydrated = useHydrated();
  const url = hydrated ? `${location.origin}/przepis/${id}` : `/przepis/${id}`;
  const image = hydrated ? `${location.origin}${recipeCover(recipe, id).src}` : "";
  const text = t.share.message(recipe.title);
  const canShare = hydrated && typeof navigator.share === "function";

  async function copy(value: string, message: string) {
    try { await navigator.clipboard.writeText(value); toast(message); } catch { toast(t.share.failed); }
  }
  async function native() {
    try { await navigator.share({ title: recipe.title, text, url }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast(t.share.failed); }
  }

  return <div className="share">
    <div className="share-link">
      <span className="share-thumb"><RecipeImage id={id} recipe={recipe} sizes="56px" /></span>
      <div><strong>{recipe.title}</strong><span>{url.replace(/^https?:\/\//, "")}</span></div>
      <button className="btn btn-secondary" onClick={() => void copy(url, t.share.copied)}><Link2 size={17} /> {t.share.copyLink}</button>
    </div>

    <ul className="share-grid">
      {networks.map(n => <li key={n.brand}>
        <a href={n.href(url, text, image)} target="_blank" rel="noopener noreferrer" className={`share-network share-network--${n.brand}`} aria-label={t.share.via(n.name)}>
          <span><BrandIcon brand={n.brand} size={22} /></span>{n.name}
        </a>
      </li>)}
      <li><a href={`mailto:?subject=${encodeURIComponent(recipe.title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`} className="share-network share-network--mail">
        <span><Mail size={22} /></span>E-mail
      </a></li>
      {canShare && <li><button className="share-network share-network--more" onClick={() => void native()}><span><Share size={22} /></span>{t.share.more}</button></li>}
    </ul>

    <h3 className="share-heading">{t.share.export}</h3>
    <div className="share-exports">
      <a className="share-export" href={`/przepis/${id}/pdf`} target="_blank" rel="noopener">
        <span className="share-export-icon"><FileText size={22} /></span><span><strong>{t.share.pdf}</strong><small>{t.share.pdfHint}</small></span>
      </a>
      <button className="share-export" onClick={onImage}>
        <span className="share-export-icon"><ImageIcon size={22} /></span><span><strong>{t.share.image}</strong><small>{t.share.imageHint}</small></span>
      </button>
      <button className="share-export" onClick={() => void copy(recipeAsText(recipe, t), t.share.textCopied)}>
        <span className="share-export-icon"><Copy size={22} /></span><span><strong>{t.share.text}</strong><small>{t.count.ingredients(recipe.ingredients.length)} · {t.count.steps(recipe.steps.length)}</small></span>
      </button>
    </div>
  </div>;
}

function ImageMaker({ id, recipe, onBack }: { id: string; recipe: Recipe; onBack: () => void }) {
  const t = useT();
  const [format, setFormat] = useState<ImageFormat>("post");
  const [result, setResult] = useState<{ format: ImageFormat; blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const file = result && new File([result.blob], `cookingtube-${id}-${result.format}.jpg`, { type: "image/jpeg" });
  const canShareFile = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  useEffect(() => {
    let cancelled = false, objectUrl = "";
    renderRecipeImage({ recipe, id, format, t, url: `${location.origin}/przepis/${id}` })
      .then(blob => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setResult({ format, blob, url: objectUrl }); setFailed(false); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [format, id, recipe, t]);

  function download() {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.url; link.download = `cookingtube-${id}-${result.format}.jpg`;
    document.body.appendChild(link); link.click(); link.remove();
  }
  async function share() {
    if (!file) return;
    try { await navigator.share({ files: [file], title: recipe.title }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast(t.share.failed); }
  }
  const ready = result?.format === format;

  return <div className="image-maker">
    <div className="segmented" role="group" aria-label={t.share.image}>
      <button aria-pressed={format === "post"} onClick={() => setFormat("post")}>{t.share.post}</button>
      <button aria-pressed={format === "story"} onClick={() => setFormat("story")}>{t.share.story}</button>
    </div>
    <div className={`image-preview image-preview--${format}`} aria-busy={!ready}>
      {ready ? <img src={result.url} alt={t.share.imageAlt(recipe.title)} /> : <span className="image-preview-wait">{failed ? t.share.failed : t.share.generating}</span>}
    </div>
    <div className="image-actions">
      <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={17} /> {t.share.back}</button>
      {canShareFile && <button className="btn btn-secondary" onClick={() => void share()} disabled={!ready}><Share2 size={17} /> {t.share.saveShare}</button>}
      <button className="btn btn-primary" onClick={download} disabled={!ready}><Download size={17} /> {t.share.download}</button>
    </div>
  </div>;
}
