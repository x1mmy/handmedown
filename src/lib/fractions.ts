const GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

export type Rational = { numerator: number; denominator: number };

function assertInt(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function reduce(numerator: number, denominator: number): Rational {
  assertInt(numerator, "numerator");
  assertInt(denominator, "denominator");
  if (denominator === 0) throw new Error("denominator must not be zero");
  if (denominator < 0) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const sign = numerator < 0 ? -1 : 1;
  const g = gcd(numerator, denominator);
  return {
    numerator: (sign * Math.abs(numerator)) / g,
    denominator: Math.abs(denominator) / g,
  };
}

/** Exact rational scale. 1 1/4 (5/4) × 2 = 5/2. */
export function scaleByFactor(
  numerator: number,
  denominator: number,
  factorNumerator: number,
  factorDenominator: number,
): Rational {
  assertInt(factorNumerator, "factor numerator");
  assertInt(factorDenominator, "factor denominator");
  if (factorDenominator <= 0 || factorNumerator <= 0) {
    throw new Error("scale factor must be a positive integer ratio");
  }
  return reduce(numerator * factorNumerator, denominator * factorDenominator);
}

/** Scale a recipe quantity from baseServings to currentServings using integers only. */
export function scaleServings(
  numerator: number,
  denominator: number,
  currentServings: number,
  baseServings: number,
): Rational {
  return scaleByFactor(numerator, denominator, currentServings, baseServings);
}

export function formatFraction(numerator: number, denominator: number): string {
  const reduced = reduce(numerator, denominator);
  const whole = Math.trunc(reduced.numerator / reduced.denominator);
  const rem = Math.abs(reduced.numerator % reduced.denominator);
  const den = reduced.denominator;
  if (rem === 0) return String(whole);
  const glyph = GLYPHS[`${rem}/${den}`] ?? `${rem}/${den}`;
  if (whole !== 0) return `${whole} ${glyph}`;
  return reduced.numerator < 0 ? `-${glyph}` : glyph;
}

export function formatQuantity(
  numerator: number,
  denominator: number,
  unit: string,
): string {
  if (numerator === 0) return unit ? unit : "";
  const qty = formatFraction(numerator, denominator);
  return unit ? `${qty} ${unit}` : qty;
}
