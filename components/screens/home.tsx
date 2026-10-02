"use client";
import Link from "next/link";
import { ArrowUpRight, Info, LayoutGrid, Timer } from "lucide-react";
import { useState } from "react";
import { findRecipe, useHydrated, useLibrary } from "@/lib/local-library";
import { popularCategories, popularRecipes, type PopularCategory } from "@/lib/popular";
import { Wordmark } from "@/components/app/brand";
import { LinkForm } from "@/components/app/link-form";
import { CategoryIcon, type CategoryIconName } from "@/components/app/media";
import { RecipeCard } from "@/components/app/recipe-card";
import { Sheet } from "@/components/app/sheet";
import { LanguageSwitch, useLocale, useT } from "@/components/app/locale";
import { useTimerCenter } from "@/components/app/timers";

const youtube = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
const categoryIcon: Record<PopularCategory, CategoryIconName> = {
  sniadania: "breakfast", obiady: "main", zupy: "soup", wege: "vege", makarony: "pasta", azjatyckie: "asian", desery: "dessert", wypieki: "bread",
};
const searchIcons: CategoryIconName[] = ["grill", "salad", "seafood", "pizza", "dumpling", "pancakes", "burger", "roast", "spicy", "drinks", "budget", "holidays"];
const ideaImages = ["insp-breakfast", "insp-pierogi", "insp-pasta", "insp-soup", "insp-pancakes", "insp-asian", "insp-salad", "insp-pizza", "insp-curry", "insp-vege", "insp-burger", "insp-dessert"];

export function HomeScreen() {
  const t = useT();
  const { locale } = useLocale();
  const library = useLibrary();
  const hydrated = useHydrated();
  const { open: openTimer } = useTimerCenter();
  const [about, setAbout] = useState(false);
  const [category, setCategory] = useState<PopularCategory | "all">("all");
  const recent = library.recipes.slice(0, 6);
  // Hearts and progress come from this device, so popular cards read through the local library.
  const popular = popularRecipes.filter(entry => category === "all" || entry.category === category).map(entry => findRecipe(library, entry.id, locale)!);
  const quick = [...popularRecipes].sort((a, b) => a.recipe.steps.length - b.recipe.steps.length).slice(0, 8).map(entry => findRecipe(library, entry.id, locale)!);
  const present = new Set(popularRecipes.map(entry => entry.category));
  const greeting = hydrated ? (new Date().getHours() >= 5 && new Date().getHours() < 18 ? t.home.morning : t.home.evening) : t.home.hello;

  return <div className="page page-home">
    <header className="mobile-top">
      <Link href="/" aria-label={t.nav.homeAria}><Wordmark /></Link>
      <div className="mobile-top-actions">
        <LanguageSwitch compact />
        <button className="icon-btn icon-btn--surface" onClick={openTimer} aria-label={t.timer.open}><Timer size={20} /></button>
        <button className="icon-btn icon-btn--surface" onClick={() => setAbout(true)} aria-label={t.home.aboutAria}><Info size={20} /></button>
      </div>
    </header>

    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-bg" src="/images/hero.webp" alt="" fetchPriority="high" />
      <div className="hero-content">
        <h1 id="hero-title"><span className={`greeting ${hydrated ? "is-ready" : ""}`}>{greeting},</span><em>{t.home.question}</em></h1>
        <p className="hero-lead">{t.home.lead}</p>
        <LinkForm />
      </div>
    </section>

    {hydrated && recent.length > 0 && <section className="section" aria-labelledby="recent-title">
      <div className="section-head"><h2 id="recent-title">{t.home.recent}</h2><Link href="/przepisy" className="link-more">{t.home.all}</Link></div>
      <div className="rail rail--feature">{recent.map((item, i) => <RecipeCard key={item.id} item={item} variant="feature" priority={i < 2} />)}</div>
    </section>}

    {popularRecipes.length > 0 && <section className="section" aria-labelledby="popular-title">
      <div className="section-head"><h2 id="popular-title">{t.home.popular}</h2><span className="section-hint">{t.home.popularHint(popularRecipes.length)}</span></div>
      <div className="categories" role="group" aria-label={t.home.category}>
        <button className="category" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
          <span className="category-icon"><LayoutGrid size={24} strokeWidth={1.8} /></span>{t.home.all}
        </button>
        {popularCategories.filter(c => present.has(c.key)).map(c => <button key={c.key} className="category" aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
          <span className="category-icon"><CategoryIcon icon={categoryIcon[c.key]} size={30} /></span>{t.popularCategories[c.key]}
        </button>)}
      </div>
      <div className="rail rail--feature rail--popular" key={category}>
        {popular.map((item, i) => <RecipeCard key={item.id} item={item} variant="feature" priority={i < 2} />)}
      </div>
    </section>}

    {quick.length > 3 && <section className="section" aria-labelledby="quick-title">
      <div className="section-head"><h2 id="quick-title">{t.home.quick}</h2><span className="section-hint">{t.home.quickHint}</span></div>
      <div className="rail rail--tiles">{quick.map(item => <RecipeCard key={item.id} item={item} />)}</div>
    </section>}

    <section className="section" aria-labelledby="ideas-title">
      <div className="section-head"><h2 id="ideas-title">{t.home.other}</h2><span className="section-hint">{t.home.otherHint} <ArrowUpRight size={14} /></span></div>
      <ul className="search-pills">
        {t.home.searches.map(([label, query], i) => <li key={label}><a href={youtube(query)} target="_blank" rel="noopener noreferrer" className="search-pill"><CategoryIcon icon={searchIcons[i]} size={22} />{label}</a></li>)}
      </ul>
      <div className="rail rail--ideas">
        {t.home.ideas.map(([title, kind, query], i) => <a key={ideaImages[i]} href={youtube(query)} target="_blank" rel="noopener noreferrer" className="idea-card">
          <img src={`/images/${ideaImages[i]}.webp`} alt="" loading="lazy" decoding="async" />
          <span className="idea-body"><span className="idea-kind">{kind}</span><strong>{title}</strong><span className="idea-cta">{t.home.searchOnYoutube} <ArrowUpRight size={14} /></span></span>
        </a>)}
      </div>
      <p className="ideas-note">{t.home.ideasNote}</p>
    </section>

    <HowItWorks />

    <Sheet open={about} onClose={() => setAbout(false)} title={t.home.aboutTitle} description={t.home.aboutDescription}>
      <HowItWorks compact />
      <p className="sheet-small">{t.home.aboutText}</p>
      <div className="sheet-lang"><span>{t.nav.language}</span><LanguageSwitch /></div>
    </Sheet>
  </div>;
}

function HowItWorks({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const icons: CategoryIconName[] = ["link", "video", "chef"];
  return <section className={`how ${compact ? "how--compact" : "section"}`} aria-label={t.home.how}>
    {!compact && <div className="section-head"><h2>{t.home.how}</h2></div>}
    <ol>{t.home.steps.map((s, i) => <li key={icons[i]}>
      <span className="how-icon"><CategoryIcon icon={icons[i]} size={compact ? 30 : 36} /></span>
      <div><span className="how-num">0{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></div>
    </li>)}</ol>
  </section>;
}
