"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Plus, Share2, Trash2 } from "lucide-react";
import { addToShopping, findRecipe, removeShopping, restoreShopping, toggleShopping, useHydrated, useLibrary, type ShoppingItem } from "@/lib/local-library";
import { count } from "@/lib/plural";
import { IngredientIcon, RecipeImage } from "@/components/app/media";
import { EmptyState } from "@/components/app/empty-state";

const productForms: [string, string, string] = ["produkt", "produkty", "produktów"];

export function ShoppingScreen() {
  const library = useLibrary();
  const { shopping } = library;
  const hydrated = useHydrated();
  const [draft, setDraft] = useState("");
  const left = shopping.filter(i => !i.checked);
  const bought = shopping.filter(i => i.checked);
  const groups = new Map<string, { title: string; recipeId: string | null; items: ShoppingItem[] }>();
  for (const item of shopping) {
    const key = item.recipeId ?? "own";
    if (!groups.has(key)) groups.set(key, { title: item.recipeTitle ?? "Dodane przez Ciebie", recipeId: item.recipeId, items: [] });
    groups.get(key)!.items.push(item);
  }

  const asText = () => left.map(i => `☐ ${i.name}${i.amount ? ` — ${i.amount}` : ""}`).join("\n");
  async function share() {
    const text = `Lista zakupów\n${asText()}`;
    try {
      if (navigator.share) return await navigator.share({ title: "Lista zakupów", text });
      await navigator.clipboard.writeText(text); toast("Skopiowano listę do schowka");
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast("Nie udało się udostępnić listy"); }
  }
  function clear(items: ShoppingItem[], message: string) {
    const removed = removeShopping(items.map(i => i.id));
    toast(message, { action: { label: "Cofnij", onClick: () => restoreShopping(removed) } });
  }

  return <div className="page page-narrow">
    <header className="page-head">
      <div>
        <span className="eyebrow">Na tym urządzeniu</span>
        <h1>Lista zakupów</h1>
        {hydrated && shopping.length > 0 && <p className="muted">{left.length ? `Zostało ${count(left.length, productForms)}` : "Wszystko kupione!"}</p>}
      </div>
      {hydrated && left.length > 0 && <div className="page-head-tools">
        <button className="icon-btn icon-btn--outline" onClick={() => void share()} aria-label="Udostępnij listę"><Share2 size={19} /></button>
        <button className="icon-btn icon-btn--outline" onClick={async () => { try { await navigator.clipboard.writeText(asText()); toast("Skopiowano listę"); } catch { toast("Nie udało się skopiować listy"); } }} aria-label="Kopiuj listę"><Copy size={19} /></button>
      </div>}
    </header>

    <form className="add-item" onSubmit={e => { e.preventDefault(); if (draft.trim()) { addToShopping([{ name: draft, amount: null }], null); setDraft(""); } }}>
      <label className="sr-only" htmlFor="new-item">Dodaj produkt</label>
      <input id="new-item" placeholder="Dodaj produkt, np. papier do pieczenia" value={draft} onChange={e => setDraft(e.target.value)} maxLength={180} autoComplete="off" />
      <button className="icon-btn icon-btn--accent" type="submit" disabled={!draft.trim()} aria-label="Dodaj do listy"><Plus size={20} /></button>
    </form>

    {!hydrated ? <div className="skeleton-list" /> : shopping.length === 0
      ? <EmptyState image="empty-shopping" title="Lista jest pusta" action={<Link className="btn btn-secondary" href="/przepisy">Wybierz przepis</Link>}>
          W przepisie odhacz składniki, które masz w kuchni, i dotknij „Dodaj brakujące” — reszta trafi tutaj.
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
            <button className="shop-remove" onClick={() => clear([item], `Usunięto: ${item.name}`)} aria-label={`Usuń ${item.name}`}><Trash2 size={16} /></button>
          </li>)}</ul>
        </section>)}
        <div className="shop-footer">
          {bought.length > 0 && <button className="btn btn-secondary" onClick={() => clear(bought, `Usunięto ${count(bought.length, productForms)}`)}><Check size={17} /> Usuń kupione ({bought.length})</button>}
          <button className="btn btn-ghost" onClick={() => clear(shopping, "Wyczyszczono listę")}><Trash2 size={17} /> Wyczyść wszystko</button>
        </div>
      </>}
  </div>;
}
