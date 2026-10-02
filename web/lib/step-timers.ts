export type StepTimer = { seconds: number; label: string };

const letters = "a-ząćęłńóśźż";
const words: Record<string, number> = {
  jedną: 1, jedna: 1, jeden: 1, dwie: 2, dwa: 2, trzy: 3, cztery: 4, pięć: 5, sześć: 6, siedem: 7, osiem: 8,
  dziewięć: 9, dziesięć: 10, piętnaście: 15, dwadzieścia: 20, trzydzieści: 30, czterdzieści: 40, pięćdziesiąt: 50,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15,
  twenty: 20, thirty: 30, forty: 40, "forty-five": 45, fifty: 50, sixty: 60,
};
const number = `(\\d+(?:[.,]\\d+)?|${Object.keys(words).join("|")})`;
const unit = `(godzin[${letters}]*|godz\\.?|hours?|hrs?(?![${letters}])|h(?![${letters}])|minut[${letters}]*|mins?\\.?(?![${letters}])|sekund[${letters}]*|seconds?|secs?(?![${letters}])|sek\\.?(?![${letters}])|s(?![${letters}]))`;
const measured = new RegExp(`(?<![${letters}\\d-])${number}(?:\\s*(?:-|–|do|to)\\s*${number})?(?:\\s|-)*${unit}`, "g");
const phrases: [RegExp, number][] = [
  [/półtorej godziny/g, 5400],
  [/pół godziny/g, 1800],
  [/kwadrans/g, 900],
  [/(?:przez|około|ok\.|jeszcze|na)\s+(?:minutę|minutkę)/g, 60],
  [/(?:przez|około|ok\.|jeszcze|na)\s+godzinę/g, 3600],
  [/an hour and a half|one and a half hours/g, 5400],
  [/half an hour/g, 1800],
  [/quarter of an hour/g, 900],
  [/(?:for|about|another|around)\s+(?:a|one)\s+minute/g, 60],
  [/(?:for|about|another|around)\s+(?:an|one)\s+hour(?!s| and)/g, 3600],
];

function value(token: string) {
  return words[token] ?? Number(token.replace(",", "."));
}
function seconds(amount: number, unitText: string) {
  if (unitText.startsWith("g") || unitText.startsWith("h")) return amount * 3600;
  if (unitText.startsWith("m")) return amount * 60;
  return amount;
}

export function formatDuration(total: number) {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), rest = s % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return rest ? `${m} min ${rest} s` : `${m} min`;
  return `${rest} s`;
}

export function formatClock(total: number) {
  const s = Math.max(0, Math.ceil(total));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), rest = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

/** Finds explicit durations in a step ("5–7 minut", "pół godziny", "8 to 10 minutes") to offer as timers. A range starts at its lower bound. */
export function findTimers(text: string): StepTimer[] {
  const source = text.normalize("NFC").toLowerCase();
  const found: { at: number; seconds: number }[] = [];
  for (const [pattern, total] of phrases) for (const match of source.matchAll(pattern)) found.push({ at: match.index, seconds: total });
  for (const match of source.matchAll(measured)) {
    const total = seconds(value(match[1]), match[3]);
    if (Number.isFinite(total)) found.push({ at: match.index, seconds: Math.round(total) });
  }
  const unique = new Map<number, StepTimer>();
  for (const { seconds: total } of found.sort((a, b) => a.at - b.at)) {
    if (total >= 5 && total <= 6 * 3600 && !unique.has(total)) unique.set(total, { seconds: total, label: formatDuration(total) });
  }
  return [...unique.values()].slice(0, 3);
}
