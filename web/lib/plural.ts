/** Polish plural: plural(5, ["krok", "kroki", "kroków"]) → "kroków". */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  if (n === 1) return one;
  const last = n % 10, tens = n % 100;
  return last >= 2 && last <= 4 && !(tens >= 12 && tens <= 14) ? few : many;
}

export const count = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`;
