"use client";
import Link from "@/components/app/app-link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Plus, Share2, Trash2 } from "lucide-react";
import { addToShopping, findRecipe, removeShopping, restoreShopping, toggleShopping, useHydrated, useLibrary, type ShoppingItem } from "@/lib/local-library";
import { IngredientIcon, RecipeImage } from "@/components/app/media";
import { EmptyState } from "@/components/app/empty-state";
import { useT } from "@/components/app/locale";


export function ShoppingScreen() {
  const t = useT();
  const library = useLibrary();
  const { shopping } = library;
  const hydrated = useHydrated();
  const [draft, setDraft] = useState("");
  const left = shopping.filter(i => !i.checked);
  const bought = shopping.filter(i => i.checked);
  const groups = new Map<string, { title: string; recipeId: string | null; items: ShoppingItem[] }>();
  for (const item of shopping) {
    const key = item.recipeId ?? "own";
    if (!groups.has(key)) groups.set(key, { title: item.recipeTitle ?? t.shopping.own, recipeId: item.recipeId, items: [] });
    groups.get(key)!.items.push(item);
  }

  const asText = () => left.map(i => `☐ ${i.name}${i.amount ? ` — ${i.amount}` : ""}`).join("\n");
  async function share() {
    const text = `${t.shopping.shareTitle}\n${asText()}`;
    try {
      if (navigator.share) return await navigator.share({ title: t.shopping.shareTitle, text });
      await navigator.clipboard.writeText(text); toast(t.shopping.copied);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast(t.shopping.shareFailed); }
  }
  function clear(items: ShoppingItem[], message: string) {
    const removed = removeShopping(items.map(i => i.id));
    toast(message, { action: { label: t.shopping.undo, onClick: () => restoreShopping(removed) } });
  }

  return <div className="page page-narrow">
    <header className="page-head">
      <div>
        <span className="eyebrow">{t.shopping.eyebrow}</span>
        <h1>{t.shopping.title}</h1>
        {hydrated && shopping.length > 0 && <p className="muted">{left.length ? t.shopping.left(left.length) : t.shopping.allBought}</p>}
      </div>
      {hydrated && left.length > 0 && <div className="page-head-tools">
        <button className="icon-btn icon-btn--outline" onClick={() => void share()} aria-label={t.shopping.share}><Share2 size={19} /></button>
        <button className="icon-btn icon-btn--outline" onClick={async () => { try { await navigator.clipboard.writeText(asText()); toast(t.shopping.copied); } catch { toast(t.shopping.copyFailed); } }} aria-label={t.shopping.copy}><Copy size={19} /></button>
      </div>}
    </header>

    <form className="add-item" onSubmit={e => { e.preventDefault(); if (draft.trim()) { addToShopping([{ name: draft, amount: null }], null); setDraft(""); } }}>
      <label className="sr-only" htmlFor="new-item">{t.shopping.add}</label>
      <input id="new-item" placeholder={t.shopping.addPlaceholder} value={draft} onChange={e => setDraft(e.target.value)} maxLength={180} autoComplete="off" />
      <button className="icon-btn icon-btn--accent" type="submit" disabled={!draft.trim()} aria-label={t.shopping.addAria}><Plus size={20} /></button>
    </form>

    {!hydrated ? <div className="skeleton-list" /> : shopping.length === 0
      ? <EmptyState image="empty-shopping" title={t.shopping.emptyTitle} action={<Link className="btn btn-secondary" href="/">{t.shopping.pick}</Link>}>
          {t.shopping.emptyText}
        </EmptyState>
      : <>
        {[...groups.values()].map(group => <section key={group.recipeId ?? "own"} className="shop-group">
          <header>
            {group.recipeId ? <Link href={`/przepis/${group.recipeId}`} className="shop-group-title"><span className="shop-thumb"><RecipeImage id={group.recipeId} sizes="36px" recipe={findRecipe(library, group.recipeId)?.recipe ?? { title: group.title, description: "", ingredients: group.items }} /></span>{group.title}</Link>
              : <span className="shop-group-title">{group.title}</span>}
            <span className="muted small">{group.items.filter(i => i.checked).length}/{group.items.length}</span>
          </header>
          <ul>{group.items.map(item => <li key={item.id} className={`shop-item ${item.checked ? "is-checked" : ""}`}>
            <button className="shop-toggle" aria-pressed={item.checked} onClick={() => toggleShopping(item.id)}>
              <span className="checkbox">{item.checked && <Check size={15} strokeWidth={3} />}</span>
              <IngredientIcon name={item.name} size={22} />
              <span className="shop-name">{item.name}</span>
              {item.amount && <span className="shop-amount">{item.amount}</span>}
            </button>
            <button className="shop-remove" onClick={() => clear([item], t.shopping.removed(item.name))} aria-label={t.shopping.remove(item.name)}><Trash2 size={16} /></button>
          </li>)}</ul>
        </section>)}
        <div className="shop-footer">
          {bought.length > 0 && <button className="btn btn-secondary" onClick={() => clear(bought, t.shopping.removedCount(bought.length))}><Check size={17} /> {t.shopping.removeBought(bought.length)}</button>}
          <button className="btn btn-ghost" onClick={() => clear(shopping, t.shopping.cleared)}><Trash2 size={17} /> {t.shopping.clearAll}</button>
        </div>
      </>}
  </div>;
}
