import { describe, expect, it } from "vitest";

import { paginate } from "@/lib/print/paginate";
import { renderPrintHtml } from "@/lib/print/render-html";
import type { ExportSnapshot } from "@/lib/types";

function snapshot(steps: string[]): ExportSnapshot {
  return {
    version: 1,
    bookId: "book",
    title: "The Fam",
    subtitle: "Recipes from three kitchens",
    clothId: "olive",
    bleed: false,
    capturedAt: "2026-11-07T00:00:00.000Z",
    recipes: [
      {
        id: "salmon",
        title: "Friday Pan-Seared Salmon",
        course: "mains",
        kitchenName: "Nan's Kitchen",
        handedDownBy: "Nan",
        recipeBy: "Nani",
        minutes: 35,
        servings: 4,
        marginNote: "Dry the skin.",
        ingredients: ["1 ¼ cups pearl couscous", "4 fillets skin-on salmon"],
        steps,
      },
    ],
    albums: [
      {
        name: "Sunday Table 2026",
        photos: [
          { src: "/api/media/1", caption: "The long table", meta: "Apr 2026" },
          { src: "/api/media/2", caption: "Salmon", meta: "Jan 2026" },
          { src: "/api/media/3", caption: "Bread", meta: "Feb 2026" },
        ],
      },
    ],
  };
}

describe("shared print pagination", () => {
  it("is stable and points the contents at the recipe page", () => {
    const pages = paginate(snapshot(["Sear the salmon.", "Rest it."]));
    const again = paginate(snapshot(["Sear the salmon.", "Rest it."]));
    expect(pages).toEqual(again);
    const contents = pages.find((page) => page.kind === "contents");
    const recipe = pages.find((page) => page.kind === "recipe");
    expect(contents && contents.kind === "contents" && contents.entries[0]?.page).toBe(
      recipe && recipe.kind === "recipe" ? recipe.pageNumber : 0,
    );
    expect(pages[0]?.kind).toBe("cover");
  });

  it("splits a long method across pages without dropping steps", () => {
    const steps = Array.from({ length: 18 }, (_, index) => `Step body ${index} `.repeat(12));
    const pages = paginate(snapshot(steps));
    const recipePages = pages.filter((page) => page.kind === "recipe");
    expect(recipePages.length).toBeGreaterThan(1);
    const seen = recipePages.flatMap((page) => (page.kind === "recipe" ? page.steps.map((step) => step.n) : []));
    expect(seen).toEqual(steps.map((_, index) => index + 1));
  });

  it("renders print html without network urls", () => {
    const html = renderPrintHtml({
      ...snapshot(["Rest the salmon."]),
      albums: [
        {
          name: "Sunday Table 2026",
          photos: [{ src: "data:image/webp;base64,AAAA", caption: "Table", meta: "Apr 2026" }],
        },
      ],
    });
    expect(html).toContain("148mm");
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain("Friday Pan-Seared Salmon");
  });
});
