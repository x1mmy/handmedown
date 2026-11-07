import { coverById, type ExportSnapshot } from "@/lib/types";

export type PrintPage =
  | {
      kind: "cover";
      title: string;
      subtitle: string;
      background: string;
      color: string;
      clothName: string;
    }
  | {
      kind: "contents";
      pageNumber: number;
      entries: { label: string; page: number }[];
    }
  | {
      kind: "recipe";
      pageNumber: number;
      title: string;
      meta: string;
      byline: string;
      note: string;
      ingredients: string[];
      steps: { n: number; text: string }[];
      continued: boolean;
      showNote: boolean;
    }
  | {
      kind: "album";
      pageNumber: number;
      album: string;
      photos: { src: string; caption: string; meta: string }[];
    };

const PAGE_BUDGET = 30;
const CONTENTS_PER_PAGE = 12;
const PHOTOS_PER_PAGE = 2;

function stepUnits(text: string): number {
  return Math.max(3, Math.ceil(text.length / 90) * 2);
}

type RecipeChunk = Omit<Extract<PrintPage, { kind: "recipe" }>, "pageNumber">;

function paginateRecipe(recipe: ExportSnapshot["recipes"][number]): RecipeChunk[] {
  const meta = `${recipe.course} · ${recipe.kitchenName} · ${recipe.minutes} min · Serves ${recipe.servings}`;
  const byline = recipe.handedDownBy ? `Handed down by ${recipe.handedDownBy}` : "Handed down";
  const steps = recipe.steps.map((text, index) => ({ n: index + 1, text, units: stepUnits(text) }));
  let ingredients = [...recipe.ingredients];
  const pages: RecipeChunk[] = [];
  let index = 0;
  let first = true;
  while (first || index < steps.length || ingredients.length > 0) {
    let budget = PAGE_BUDGET - 8;
    const chunk: RecipeChunk = {
      kind: "recipe",
      title: recipe.title,
      meta,
      byline,
      note: recipe.marginNote,
      ingredients: [],
      steps: [],
      continued: !first,
      showNote: false,
    };
    if (first && recipe.marginNote) {
      chunk.showNote = true;
      budget -= 6;
    }
    if (ingredients.length > 0 && budget > 2) {
      const room = Math.max(1, budget - 2);
      const take = Math.min(ingredients.length, room);
      chunk.ingredients = ingredients.slice(0, take);
      ingredients = ingredients.slice(take);
      budget -= take + 2;
    }
    while (index < steps.length && budget >= steps[index].units) {
      chunk.steps.push({ n: steps[index].n, text: steps[index].text });
      budget -= steps[index].units;
      index += 1;
    }
    if (chunk.ingredients.length === 0 && chunk.steps.length === 0 && index < steps.length) {
      chunk.steps.push({ n: steps[index].n, text: steps[index].text });
      index += 1;
    }
    pages.push(chunk);
    first = false;
    if (index >= steps.length && ingredients.length === 0) break;
    if (pages.length > 48) break;
  }
  return pages;
}

function paginateAlbum(album: ExportSnapshot["albums"][number]): Omit<Extract<PrintPage, { kind: "album" }>, "pageNumber">[] {
  const pages: Omit<Extract<PrintPage, { kind: "album" }>, "pageNumber">[] = [];
  for (let i = 0; i < album.photos.length; i += PHOTOS_PER_PAGE) {
    pages.push({
      kind: "album",
      album: album.name,
      photos: album.photos.slice(i, i + PHOTOS_PER_PAGE),
    });
  }
  return pages;
}

export function paginate(snapshot: ExportSnapshot): PrintPage[] {
  const cloth = coverById(snapshot.clothId);
  const body: Array<Extract<PrintPage, { pageNumber: number }>> = [];
  const entries: { label: string; bodyIndex: number }[] = [];

  for (const recipe of snapshot.recipes) {
    const chunks = paginateRecipe(recipe);
    if (chunks.length === 0) continue;
    entries.push({ label: recipe.title, bodyIndex: body.length });
    for (const chunk of chunks) body.push({ ...chunk, pageNumber: 0 });
  }
  for (const album of snapshot.albums) {
    const chunks = paginateAlbum(album);
    if (chunks.length === 0) continue;
    entries.push({ label: album.name, bodyIndex: body.length });
    for (const chunk of chunks) body.push({ ...chunk, pageNumber: 0 });
  }

  const contentSheets: { label: string; page: number }[][] = [];
  const contentsCount = Math.max(1, Math.ceil(entries.length / CONTENTS_PER_PAGE));
  for (let i = 0; i < contentsCount; i += 1) contentSheets.push([]);
  entries.forEach((entry, index) => {
    const sheet = Math.min(contentsCount - 1, Math.floor(index / CONTENTS_PER_PAGE));
    contentSheets[sheet].push({
      label: entry.label,
      page: contentsCount + entry.bodyIndex + 1,
    });
  });

  const pages: PrintPage[] = [
    {
      kind: "cover",
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      background: cloth.background,
      color: cloth.color,
      clothName: cloth.name,
    },
  ];
  contentSheets.forEach((sheet, index) => {
    pages.push({ kind: "contents", pageNumber: index + 1, entries: sheet });
  });
  body.forEach((page, index) => {
    pages.push({ ...page, pageNumber: contentsCount + index + 1 });
  });
  return pages;
}

export function pageBudget(): number {
  return PAGE_BUDGET;
}
