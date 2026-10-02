"use client";
import Link from "next/link";
import { ArrowUpRight, Info, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { findRecipe, useHydrated, useLibrary } from "@/lib/local-library";
import { popularCategories, popularRecipes, type PopularCategory } from "@/lib/popular";
import { Wordmark } from "@/components/app/brand";
import { LinkForm } from "@/components/app/link-form";
import { CategoryIcon, type CategoryIconName } from "@/components/app/media";
import { RecipeCard } from "@/components/app/recipe-card";
import { Sheet } from "@/components/app/sheet";

const youtube = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
const categoryIcon: Record<PopularCategory, CategoryIconName> = {
  sniadania: "breakfast", obiady: "main", zupy: "soup", wege: "vege", makarony: "pasta", azjatyckie: "asian", desery: "dessert", wypieki: "bread",
};
const searches: { icon: CategoryIconName; label: string; query: string }[] = [
  { icon: "grill", label: "Grill", query: "grill przepis" },
  { icon: "salad", label: "Sałatki", query: "sałatka przepis" },
  { icon: "seafood", label: "Ryby i owoce morza", query: "ryba przepis" },
  { icon: "pizza", label: "Pizza", query: "domowa pizza przepis" },
  { icon: "dumpling", label: "Pierogi", query: "pierogi przepis" },
  { icon: "pancakes", label: "Naleśniki", query: "naleśniki przepis" },
  { icon: "burger", label: "Burgery", query: "burger przepis" },
  { icon: "roast", label: "Pieczenie mięs", query: "pieczony kurczak przepis" },
  { icon: "spicy", label: "Na ostro", query: "ostre danie przepis" },
  { icon: "drinks", label: "Koktajle", query: "koktajl owocowy przepis" },
  { icon: "budget", label: "Tanie obiady", query: "tani obiad przepis" },
  { icon: "holidays", label: "Na święta", query: "świąteczne przepisy" },
];
const ideas = [
  { image: "insp-breakfast", title: "Szakszuka", kind: "Śniadanie", query: "szakszuka przepis" },
  { image: "insp-pierogi", title: "Pierogi z cebulką", kind: "Kuchnia polska", query: "pierogi ruskie przepis" },
  { image: "insp-pasta", title: "Tagliatelle z grzybami", kind: "Makaron", query: "tagliatelle z grzybami przepis" },
  { image: "insp-soup", title: "Krem z pieczonej dyni", kind: "Zupa", query: "krem z dyni przepis" },
  { image: "insp-pancakes", title: "Puszyste pancakes", kind: "Śniadanie", query: "pancakes przepis" },
  { image: "insp-asian", title: "Stir-fry z kurczakiem", kind: "Azjatyckie", query: "stir fry z kurczakiem przepis" },
  { image: "insp-salad", title: "Sałatka grecka", kind: "Sałatka", query: "sałatka grecka przepis" },
  { image: "insp-pizza", title: "Pizza margherita", kind: "Pizza", query: "pizza margherita przepis" },
  { image: "insp-curry", title: "Kurczak curry", kind: "Azjatyckie", query: "kurczak curry przepis" },
  { image: "insp-vege", title: "Miska Buddy", kind: "Wege", query: "buddha bowl przepis" },
  { image: "insp-burger", title: "Domowy burger", kind: "Obiad", query: "domowy burger przepis" },
  { image: "insp-dessert", title: "Tiramisu w szklance", kind: "Deser", query: "tiramisu w pucharkach przepis" },
];
const greeting = (hour: number) => hour >= 5 && hour < 18 ? "Dzień dobry" : "Dobry wieczór";

export function HomeScreen() {
  const library = useLibrary();
  const hydrated = useHydrated();
  const [about, setAbout] = useState(false);
  const [category, setCategory] = useState<PopularCategory | "all">("all");
  const recent = library.recipes.slice(0, 6);
  // Hearts and progress come from this device, so popular cards read through the local library.
  const popular = popularRecipes.filter(entry => category === "all" || entry.category === category).map(entry => ({ entry, item: findRecipe(library, entry.id)! }));
  const quick = [...popularRecipes].sort((a, b) => a.recipe.steps.length - b.recipe.steps.length).slice(0, 8).map(entry => findRecipe(library, entry.id)!);
  const present = new Set(popularRecipes.map(entry => entry.category));

  return <div className="page page-home">
    <header className="mobile-top">
      <Link href="/" aria-label="CookingTube — start"><Wordmark /></Link>
      <button className="icon-btn icon-btn--surface" onClick={() => setAbout(true)} aria-label="Jak działa CookingTube"><Info size={20} /></button>
    </header>

    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-bg" src="/images/hero.webp" alt="" fetchPriority="high" />
      <div className="hero-content">
        <h1 id="hero-title"><span className={`greeting ${hydrated ? "is-ready" : ""}`}>{hydrated ? greeting(new Date().getHours()) : "Cześć"},</span><em>co dziś gotujemy?</em></h1>
        <p className="hero-lead">Wklej link do filmu z YouTube, a zamienimy go w przepis: składniki, kroki i minutniki.</p>
        <LinkForm />
      </div>
    </section>

    {hydrated && recent.length > 0 && <section className="section" aria-labelledby="recent-title">
      <div className="section-head"><h2 id="recent-title">Ostatnio przygotowane</h2><Link href="/przepisy" className="link-more">Wszystkie</Link></div>
      <div className="rail rail--feature">{recent.map((item, i) => <RecipeCard key={item.id} item={item} variant="feature" priority={i < 2} />)}</div>
    </section>}

    {popularRecipes.length > 0 && <section className="section" aria-labelledby="popular-title">
      <div className="section-head"><h2 id="popular-title">Popularne przepisy</h2><span className="section-hint">{popularRecipes.length} z ulubionych filmów</span></div>
      <div className="categories" role="group" aria-label="Kategoria">
        <button className="category" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
          <span className="category-icon"><LayoutGrid size={24} strokeWidth={1.8} /></span>Wszystkie
        </button>
        {popularCategories.filter(c => present.has(c.key)).map(c => <button key={c.key} className="category" aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
          <span className="category-icon"><CategoryIcon icon={categoryIcon[c.key]} size={30} /></span>{c.label}
        </button>)}
      </div>
      <div className="rail rail--feature rail--popular" key={category}>
        {popular.map(({ entry, item }, i) => <RecipeCard key={entry.id} item={item} variant="feature" priority={i < 2} />)}
      </div>
    </section>}

    {quick.length > 3 && <section className="section" aria-labelledby="quick-title">
      <div className="section-head"><h2 id="quick-title">Szybkie i proste</h2><span className="section-hint">Najmniej kroków</span></div>
      <div className="rail rail--tiles">{quick.map(item => <RecipeCard key={item.id} item={item} />)}</div>
    </section>}

    <section className="section" aria-labelledby="ideas-title">
      <div className="section-head"><h2 id="ideas-title">Szukasz czegoś innego?</h2><span className="section-hint">Otwiera YouTube <ArrowUpRight size={14} /></span></div>
      <ul className="search-pills">
        {searches.map(s => <li key={s.icon}><a href={youtube(s.query)} target="_blank" rel="noopener noreferrer" className="search-pill"><CategoryIcon icon={s.icon} size={22} />{s.label}</a></li>)}
      </ul>
      <div className="rail rail--ideas">
        {ideas.map(idea => <a key={idea.image} href={youtube(idea.query)} target="_blank" rel="noopener noreferrer" className="idea-card">
          <img src={`/images/${idea.image}.webp`} alt="" loading="lazy" decoding="async" />
          <span className="idea-body"><span className="idea-kind">{idea.kind}</span><strong>{idea.title}</strong><span className="idea-cta">Szukaj na YouTube <ArrowUpRight size={14} /></span></span>
        </a>)}
      </div>
      <p className="ideas-note">Znajdź film, skopiuj link i wklej go powyżej — przepis będzie gotowy zwykle w minutę lub dwie.</p>
    </section>

    <HowItWorks />

    <Sheet open={about} onClose={() => setAbout(false)} title="Jak działa CookingTube" description="Z filmu na talerz w trzech krokach.">
      <HowItWorks compact />
      <p className="sheet-small">Przepis przygotowuje model Gemini na podstawie obrazu i dźwięku filmu. Ilości, których autor nie podał wprost, zostają puste. Popularne przepisy przygotowaliśmy tą samą metodą z publicznych filmów ich autorów. Twoje przepisy, ulubione i lista zakupów zapisują się tylko w tej przeglądarce — bez konta i bez synchronizacji.</p>
    </Sheet>
  </div>;
}

function HowItWorks({ compact = false }: { compact?: boolean }) {
  const steps: { icon: CategoryIconName; title: string; text: string }[] = [
    { icon: "link", title: "Wklej link", text: "Skopiuj adres filmu z YouTube — zwykłego albo Shorts." },
    { icon: "video", title: "Daj nam chwilę", text: "AI ogląda film i spisuje składniki oraz kolejne kroki." },
    { icon: "chef", title: "Gotuj krok po kroku", text: "Duże litery, minutniki i ekran, który nie gaśnie." },
  ];
  return <section className={`how ${compact ? "how--compact" : "section"}`} aria-label="Jak to działa">
    {!compact && <div className="section-head"><h2>Jak to działa</h2></div>}
    <ol>{steps.map((s, i) => <li key={s.icon}>
      <span className="how-icon"><CategoryIcon icon={s.icon} size={compact ? 30 : 36} /></span>
      <div><span className="how-num">0{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></div>
    </li>)}</ol>
  </section>;
}
