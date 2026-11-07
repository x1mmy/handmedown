import { describe, expect, it } from "vitest";

import { DemoRepository, createSeedState } from "@/lib/repository/demo";
import {
  EXAMPLE_BOOK_ID,
  KITCHEN_NAN,
  KITCHEN_SAM,
  RECIPE_SALMON,
  USER_LEILA,
  USER_NAN,
  USER_OUTSIDER,
  USER_PREVIEW,
  USER_SAM,
} from "@/lib/seed/example-book";
import type { Principal, RecipeInput } from "@/lib/types";

const owner: Principal = { userId: USER_PREVIEW, preview: false };
const nan: Principal = { userId: USER_NAN, preview: false };
const sam: Principal = { userId: USER_SAM, preview: false };
const leila: Principal = { userId: USER_LEILA, preview: false };
const outsider: Principal = { userId: USER_OUTSIDER, preview: false };
const anon: Principal = { userId: null, preview: true };

function input(kitchenId: string, title = "Weeknight rice"): RecipeInput {
  return {
    kitchenId,
    title,
    handedDownBy: "Nan",
    recipeBy: "Nani",
    course: "mains",
    minutes: 20,
    servings: 4,
    marginNote: "",
    ingredients: [
      { numerator: 1, denominator: 1, unit: "cup", item: "rice", original_text: "1 cup rice" },
    ],
    steps: ["Simmer until tender."],
  };
}

describe("demo repository permissions", () => {
  it("lets anyone with the link open the shared book and lists only that book", async () => {
    const repo = DemoRepository.create(createSeedState());
    const example = await repo.getBook(outsider, EXAMPLE_BOOK_ID);
    expect(example.access).toBe("owner");
    await expect(repo.getBook(outsider, "20000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ status: 404 });
    const books = await repo.listMyBooks(anon);
    expect(books.map((book) => book.id)).toEqual([EXAMPLE_BOOK_ID]);
  });

  it("stops a member editing another kitchen", async () => {
    const repo = DemoRepository.create(createSeedState());
    const recipe = await repo.getRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    const moved = await repo.updateRecipe(sam, EXAMPLE_BOOK_ID, RECIPE_SALMON, recipe.version, input(KITCHEN_SAM, "Salmon in another kitchen"));
    expect(moved.version).toBe(recipe.version + 1);
  });

  it("does not expose invites or kitchen membership", async () => {
    const repo = DemoRepository.create(createSeedState());
    await expect(repo.grantKitchenMember(owner, EXAMPLE_BOOK_ID, KITCHEN_SAM, USER_PREVIEW)).rejects.toMatchObject({ status: 404 });
    await expect(repo.requestJoin(leila, EXAMPLE_BOOK_ID, KITCHEN_SAM)).rejects.toMatchObject({ status: 404 });
    await expect(repo.createInvite(owner, EXAMPLE_BOOK_ID)).rejects.toMatchObject({ status: 404 });
    await expect(repo.redeemInvite(outsider, "not-a-token")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a foreign book, recipe, photo, and pdf", async () => {
    const repo = DemoRepository.create(createSeedState());
    const foreign = "20000000-0000-4000-8000-000000000099";
    await expect(repo.createRecipe(outsider, foreign, input(KITCHEN_NAN))).rejects.toMatchObject({ status: 404 });
    await expect(repo.getRecipe(nan, EXAMPLE_BOOK_ID, foreign)).rejects.toMatchObject({ status: 404 });
    await expect(repo.updateRecipe(nan, EXAMPLE_BOOK_ID, foreign, 1, input(KITCHEN_NAN))).rejects.toMatchObject({ status: 404 });
    await expect(repo.readMedia(nan, foreign)).rejects.toMatchObject({ status: 404 });
    await expect(repo.readExportPdf(nan, foreign)).rejects.toMatchObject({ status: 404 });
    await expect(repo.updateKitchenName(owner, EXAMPLE_BOOK_ID, foreign, "Nope")).rejects.toMatchObject({ status: 404 });
  });

  it("replays cooks and the shared-book bootstrap without doubling", async () => {
    const repo = DemoRepository.create(createSeedState());
    const draft = { draftKey: "same-draft-key", title: "Twice", kitchenName: "Home" };
    const created = await repo.createBookFromDraft(sam, draft);
    const replay = await repo.createBookFromDraft(leila, draft);
    expect(created).toEqual({ bookId: EXAMPLE_BOOK_ID, created: false });
    expect(replay).toEqual(created);

    const cooks = await Promise.all([
      repo.incrementCooked(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON, "same-key"),
      repo.incrementCooked(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON, "same-key"),
    ]);
    expect(cooks.map((item) => item.cookedCount)).toEqual([35, 35]);
    expect(cooks.filter((item) => item.applied)).toHaveLength(1);
  });

  it("counts concurrent cooks exactly once per key", async () => {
    const repo = DemoRepository.create(createSeedState());
    const keys = Array.from({ length: 20 }, (_, index) => `cook-${index}`);
    await Promise.all(keys.map((key) => repo.incrementCooked(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON, key)));
    await Promise.all(keys.map((key) => repo.incrementCooked(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON, key)));
    const recipe = await repo.getRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    expect(recipe.cookedCount).toBe(34 + 20);
  });

  it("returns 409 for a stale edit", async () => {
    const repo = DemoRepository.create(createSeedState());
    const recipe = await repo.getRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    await repo.updateRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON, recipe.version, input(KITCHEN_NAN, "First save"));
    await expect(
      repo.updateRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON, recipe.version, input(KITCHEN_NAN, "Stale save")),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("undoes a delete inside six seconds and still blocks kitchen removal", async () => {
    let now = 1_000_000;
    const repo = DemoRepository.create(createSeedState(), { now: () => now });
    await repo.softDeleteRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    now += 1000;
    await repo.undoDeleteRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    const restored = await repo.getRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    expect(restored.deletedAt).toBeNull();
    await repo.softDeleteRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON);
    await expect(repo.deleteKitchen(owner, EXAMPLE_BOOK_ID, KITCHEN_NAN)).rejects.toMatchObject({ status: 409 });
    now += 6001;
    await expect(repo.undoDeleteRecipe(nan, EXAMPLE_BOOK_ID, RECIPE_SALMON)).rejects.toMatchObject({ status: 409 });
    await expect(repo.deleteKitchen(owner, EXAMPLE_BOOK_ID, KITCHEN_NAN)).rejects.toMatchObject({ status: 409 });
    const empty = await repo.createKitchen(owner, EXAMPLE_BOOK_ID, "Spare");
    await repo.deleteKitchen(owner, EXAMPLE_BOOK_ID, empty.id);
  });

  it("rejects an unsafe photo and keeps an export snapshot immutable", async () => {
    const repo = DemoRepository.create(createSeedState());
    const albums = await repo.listAlbums(anon, EXAMPLE_BOOK_ID);
    await expect(
      repo.addReadyPhoto(anon, {
        bookId: EXAMPLE_BOOK_ID,
        albumId: albums[0]!.id,
        kitchenId: KITCHEN_NAN,
        caption: "nope",
        bytes: new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
        declaredMime: "image/svg+xml",
      }),
    ).rejects.toMatchObject({ status: 422 });

    let seenTitle = "";
    const job = await repo.createExport(owner, EXAMPLE_BOOK_ID, { clothId: "oxblood", bleed: false }, async (snapshot) => {
      seenTitle = snapshot.title;
      snapshot.title = "mutated by worker";
      return Buffer.from("%PDF-1.4\n");
    });
    expect(job.status).toBe("ready");
    await repo.updateBookTitle(owner, EXAMPLE_BOOK_ID, "A different title");
    const stored = await repo.readExportSnapshot(owner, job.jobId);
    expect(stored.title).toBe(seenTitle);
    expect(stored.title).toBe("The Fam");
    expect(stored.clothId).toBe("oxblood");
  });

  it("opens the example book without a sign-in and names a blank book The Fam", async () => {
    const repo = DemoRepository.create(createSeedState());
    const book = await repo.getBook(anon, EXAMPLE_BOOK_ID);
    expect(book.title).toBe("The Fam");
    expect(book.recipeCount).toBe(7);
    await repo.updateBookTitle(anon, EXAMPLE_BOOK_ID, "   ");
    const renamed = await repo.getBook(anon, EXAMPLE_BOOK_ID);
    expect(renamed.title).toBe("The Fam");
    const created = await repo.createBookFromDraft(anon, { draftKey: "anon-draft-key", title: "   ", kitchenName: "Nope" });
    expect(created).toEqual({ bookId: EXAMPLE_BOOK_ID, created: false });
  });
});
