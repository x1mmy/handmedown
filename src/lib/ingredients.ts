import { AppError } from "@/lib/errors";
import type { Ingredient } from "@/lib/types";

const VULGAR: Record<string, [number, number]> = {
  "½": [1, 2],
  "⅓": [1, 3],
  "⅔": [2, 3],
  "¼": [1, 4],
  "¾": [3, 4],
  "⅛": [1, 8],
  "⅜": [3, 8],
  "⅝": [5, 8],
  "⅞": [7, 8],
};

const UNITS = new Set([
  "cup",
  "cups",
  "tbsp",
  "tsp",
  "g",
  "kg",
  "ml",
  "l",
  "fillet",
  "fillets",
  "pinch",
  "clove",
  "cloves",
  "bunch",
  "slice",
  "slices",
  "lemon",
  "lemons",
  "egg",
  "eggs",
  "can",
  "cans",
]);

type Leading = { numerator: number; denominator: number; consumed: number };

function leadingQuantity(line: string): Leading | null {
  const mixed = line.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return { numerator: whole * den + num, denominator: den, consumed: mixed[0].length };
  }
  const mixedVulgar = line.match(/^(\d+)\s+([½⅓⅔¼¾⅛⅜⅝⅞])/);
  if (mixedVulgar) {
    const [num, den] = VULGAR[mixedVulgar[2]];
    const whole = Number(mixedVulgar[1]);
    return {
      numerator: whole * den + num,
      denominator: den,
      consumed: mixedVulgar[0].length,
    };
  }
  const frac = line.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return { numerator: Number(frac[1]), denominator: den, consumed: frac[0].length };
  }
  const vulgar = line.match(/^([½⅓⅔¼¾⅛⅜⅝⅞])/);
  if (vulgar) {
    const [num, den] = VULGAR[vulgar[1]];
    return { numerator: num, denominator: den, consumed: vulgar[0].length };
  }
  const whole = line.match(/^(\d+)/);
  if (whole) {
    return { numerator: Number(whole[1]), denominator: 1, consumed: whole[0].length };
  }
  return null;
}

export function parseIngredientLine(line: string): Ingredient {
  const original_text = line.trim().replace(/\s+/g, " ");
  if (!original_text) throw new AppError(422, "An ingredient line is empty");
  const leading = leadingQuantity(original_text);
  if (!leading) {
    return {
      numerator: 0,
      denominator: 1,
      unit: "",
      item: original_text,
      original_text,
    };
  }
  let rest = original_text.slice(leading.consumed).trim();
  let unit = "";
  const unitMatch = rest.match(/^([A-Za-z]+)\b/);
  if (unitMatch && UNITS.has(unitMatch[1].toLowerCase())) {
    unit = unitMatch[1].toLowerCase();
    rest = rest.slice(unitMatch[1].length).trim();
  }
  return {
    numerator: leading.numerator,
    denominator: leading.denominator,
    unit,
    item: rest || original_text,
    original_text,
  };
}

export function parseIngredientLines(text: string): Ingredient[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new AppError(422, "Add at least one ingredient");
  return lines.map(parseIngredientLine);
}

export function formatIngredientLines(ingredients: Ingredient[]): string {
  return ingredients
    .map((ingredient) => ingredient.original_text || ingredient.item)
    .join("\n");
}
