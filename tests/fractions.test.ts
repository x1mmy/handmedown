import { describe, expect, it } from "vitest";

import { formatFraction, formatQuantity, scaleByFactor, scaleServings } from "@/lib/fractions";
import { parseIngredientLine } from "@/lib/ingredients";

describe("exact fraction scaling", () => {
  it("scales 1 1/4 × 2 to 2 1/2", () => {
    const scaled = scaleByFactor(5, 4, 2, 1);
    expect(scaled).toEqual({ numerator: 5, denominator: 2 });
    expect(formatFraction(scaled.numerator, scaled.denominator)).toBe("2 ½");
    expect(formatQuantity(scaled.numerator, scaled.denominator, "cups")).toBe("2 ½ cups");
  });

  it("keeps thirds exact when servings change", () => {
    expect(scaleServings(1, 3, 12, 4)).toEqual({ numerator: 1, denominator: 1 });
    expect(formatFraction(2, 3)).toBe("⅔");
    expect(formatFraction(7, 5)).toBe("1 ⅖");
    expect(formatFraction(5, 7)).toBe("5/7");
  });

  it("parses a mixed number without using floats", () => {
    const ingredient = parseIngredientLine("1 1/4 cups pearl couscous");
    expect(ingredient.numerator).toBe(5);
    expect(ingredient.denominator).toBe(4);
    expect(ingredient.unit).toBe("cups");
    expect(ingredient.item).toBe("pearl couscous");
  });
});
