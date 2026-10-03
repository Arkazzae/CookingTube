/* A dependency-free last resort if a route's Next.js bundle was not cached. */
const polish = (navigator.languages?.[0] || navigator.language || "en").toLowerCase().startsWith("pl");
document.documentElement.lang = polish ? "pl" : "en";
const text = (pl, en) => polish ? pl : en;
document.querySelector("#title").textContent = text("Jesteś offline.", "You're offline.");
document.querySelector("#message").textContent = text("Zapisane przepisy są nadal na tym urządzeniu. Filmy i głosowanie wymagają internetu.", "Your saved recipes are still on this device. Videos and voting need an internet connection.");
document.querySelector("#retry").textContent = text("Otwórz przepisy", "Open recipes");
document.querySelector("#built-by").textContent = text("Zbudowane przez", "Built by");
function element(tag, value) { const node = document.createElement(tag); node.textContent = String(value); return node; }
try {
  const state = JSON.parse(localStorage.getItem("cookingtube:v1") || "{}");
  const recipes = Array.isArray(state.recipes) ? state.recipes.slice(0, 100) : [];
  for (const item of recipes) {
    const recipe = item?.recipe;
    if (!recipe || typeof recipe.title !== "string" || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) continue;
    const row = document.createElement("li");
    const button = element("button", recipe.title);
    button.addEventListener("click", () => {
      const target = document.querySelector("#recipe");
      target.replaceChildren(element("h2", recipe.title), element("p", recipe.description || ""), element("h3", text("Składniki", "Ingredients")));
      for (const ingredient of recipe.ingredients.slice(0, 60)) target.appendChild(element("p", `${ingredient.name || ""}${ingredient.amount ? ` — ${ingredient.amount}` : ""}`));
      target.appendChild(element("h3", text("Przygotowanie", "Preparation")));
      recipe.steps.slice(0, 30).forEach((step, index) => target.appendChild(element("p", `${index + 1}. ${step.title || ""}\n${step.description || ""}`)));
      target.scrollIntoView();
    });
    row.appendChild(button); document.querySelector("#recipes").appendChild(row);
  }
} catch { document.querySelector("#recipes").textContent = text("Nie udało się odczytać lokalnej biblioteki.", "We could not read the local library."); }
