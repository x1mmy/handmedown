import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { normalizeBookName, UNDO_WINDOW_MS } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { formatQuantity } from "@/lib/fractions";
import { reencodeUpload } from "@/lib/validation/upload";
import {
  ALBUM_BAKES,
  ALBUM_EID,
  ALBUM_SUNDAY,
  EXAMPLE_BOOK_ID,
  KITCHEN_COOP,
  KITCHEN_NAN,
  KITCHEN_SAM,
  MEDIA_BREAD,
  MEDIA_PILAF,
  MEDIA_ROAST,
  MEDIA_TABLE,
  MEDIA_TABLE_SET,
  MEDIA_TART,
  RECIPE_BREAD,
  RECIPE_SALMON,
  RECIPE_TART,
  SEED_BOOK,
  SEED_RECIPES,
  SEED_USERS,
  USER_LEILA,
  USER_NAN,
  USER_PREVIEW,
  USER_SAM,
  USER_TOM,
} from "@/lib/seed/example-book";
import type { SeedRecipe } from "@/lib/seed/example-book";
import { COURSES, coverById, type AlbumView, type BookAccess, type BookDetail, type BookSummary, type CoverId, type ExportSnapshot, type Ingredient, type InviteView, type KitchenDesk, type Principal, type RecipeCard, type RecipeDetail, type RecipeFilters, type RecipeInput } from "@/lib/types";

type Role = "owner" | "reader";
type KitchenRole = "lead" | "cook";

type BookRow = {
  id: string;
  title: string;
  ownerId: string;
  draftKey: string | null;
  isExample: boolean;
  createdAt: number;
};
type MemberRow = { bookId: string; userId: string; role: Role };
type KitchenRow = { id: string; bookId: string; name: string };
type KitchenMemberRow = { bookId: string; kitchenId: string; userId: string; role: KitchenRole };
type JoinRow = {
  id: string;
  bookId: string;
  kitchenId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};
type FavouriteRow = { bookId: string; recipeId: string; userId: string };
type AlbumRow = { id: string; bookId: string; name: string };
type MediaRow = {
  id: string;
  bookId: string;
  kitchenId: string | null;
  ownerId: string;
  storagePath: string;
  mime: string;
  status: "quarantine" | "ready" | "rejected";
  width: number;
  height: number;
};
type PhotoRow = {
  id: string;
  bookId: string;
  albumId: string;
  mediaId: string;
  kitchenId: string | null;
  caption: string;
  takenOn: string;
};
type InviteRow = {
  id: string;
  bookId: string;
  tokenHash: string;
  createdBy: string;
  revokedAt: number | null;
  redeemedBy: string | null;
  redeemedAt: number | null;
  createdAt: number;
};
type CookRow = { id: string; bookId: string; recipeId: string; userId: string; idempotencyKey: string };
type ExportRow = {
  id: string;
  bookId: string;
  requestedBy: string;
  status: "queued" | "ready" | "failed";
  snapshot: ExportSnapshot;
  error: string | null;
  createdAt: number;
};
type UserRow = { id: string; email: string; name: string };

export type DemoState = {
  users: UserRow[];
  books: BookRow[];
  bookMembers: MemberRow[];
  kitchens: KitchenRow[];
  kitchenMembers: KitchenMemberRow[];
  joinRequests: JoinRow[];
  recipes: SeedRecipe[];
  favourites: FavouriteRow[];
  albums: AlbumRow[];
  media: MediaRow[];
  photos: PhotoRow[];
  invites: InviteRow[];
  cookingEvents: CookRow[];
  exportJobs: ExportRow[];
};

type Resolved = { book: BookRow; userId: string | null; access: BookAccess };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requireText(value: string, label: string, max = 160): string {
  const text = value.trim();
  if (!text) throw new AppError(422, `${label} is required`);
  if (text.length > max) throw new AppError(422, `${label} is too long`);
  return text;
}

function assertIngredient(ingredient: Ingredient): void {
  if (!Number.isInteger(ingredient.numerator) || !Number.isInteger(ingredient.denominator)) {
    throw new AppError(422, "Ingredient quantities must be exact integers");
  }
  if (ingredient.denominator <= 0 || ingredient.numerator < 0) {
    throw new AppError(422, "Ingredient quantities must be exact integers");
  }
  if (!ingredient.item.trim() && !ingredient.original_text.trim()) {
    throw new AppError(422, "An ingredient is missing its name");
  }
}

function assertRecipeInput(input: RecipeInput): RecipeInput {
  const title = requireText(input.title, "Title", 140);
  const course = input.course;
  if (!COURSES.includes(course)) throw new AppError(422, "Choose a course");
  if (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > 100) {
    throw new AppError(422, "Servings must be a whole number");
  }
  if (!Number.isInteger(input.minutes) || input.minutes < 0 || input.minutes > 24 * 60) {
    throw new AppError(422, "Time must be a whole number of minutes");
  }
  if (input.ingredients.length === 0) throw new AppError(422, "Add at least one ingredient");
  input.ingredients.forEach(assertIngredient);
  const steps = input.steps.map((step) => step.trim()).filter(Boolean);
  if (steps.length === 0) throw new AppError(422, "Add at least one step");
  return {
    ...input,
    title,
    handedDownBy: input.handedDownBy.trim().slice(0, 140),
    recipeBy: (input.recipeBy ?? "").trim().slice(0, 80),
    marginNote: input.marginNote.trim().slice(0, 600),
    steps,
  };
}

export function createSeedState(): DemoState {
  const bookId = EXAMPLE_BOOK_ID;
  return {
    users: structuredClone(SEED_USERS),
    books: [structuredClone(SEED_BOOK)],
    bookMembers: [
      { bookId, userId: USER_PREVIEW, role: "owner" },
      { bookId, userId: USER_NAN, role: "reader" },
      { bookId, userId: USER_SAM, role: "reader" },
      { bookId, userId: USER_TOM, role: "reader" },
      { bookId, userId: USER_LEILA, role: "reader" },
    ],
    kitchens: [
      { id: KITCHEN_NAN, bookId, name: "Nan's Kitchen" },
      { id: KITCHEN_SAM, bookId, name: "Sam & Leila" },
      { id: KITCHEN_COOP, bookId, name: "The Fam" },
    ],
    kitchenMembers: [
      { bookId, kitchenId: KITCHEN_NAN, userId: USER_PREVIEW, role: "lead" },
      { bookId, kitchenId: KITCHEN_SAM, userId: USER_PREVIEW, role: "lead" },
      { bookId, kitchenId: KITCHEN_COOP, userId: USER_PREVIEW, role: "lead" },
      { bookId, kitchenId: KITCHEN_NAN, userId: USER_NAN, role: "lead" },
      { bookId, kitchenId: KITCHEN_SAM, userId: USER_SAM, role: "lead" },
      { bookId, kitchenId: KITCHEN_COOP, userId: USER_TOM, role: "lead" },
    ],
    joinRequests: [],
    recipes: structuredClone(SEED_RECIPES),
    favourites: [
      { bookId, recipeId: RECIPE_SALMON, userId: USER_PREVIEW },
      { bookId, recipeId: RECIPE_TART, userId: USER_PREVIEW },
      { bookId, recipeId: RECIPE_BREAD, userId: USER_PREVIEW },
      { bookId, recipeId: RECIPE_SALMON, userId: USER_NAN },
      { bookId, recipeId: RECIPE_TART, userId: USER_SAM },
      { bookId, recipeId: RECIPE_BREAD, userId: USER_TOM },
    ],
    albums: [
      { id: ALBUM_SUNDAY, bookId, name: "Sunday Table 2026" },
      { id: ALBUM_EID, bookId, name: "Eid Lunch" },
      { id: ALBUM_BAKES, bookId, name: "Holiday Bakes" },
    ],
    media: [
      media(MEDIA_TABLE, KITCHEN_NAN, USER_NAN, "seed/table.webp"),
      media(MEDIA_TART, KITCHEN_SAM, USER_SAM, "seed/tart.webp"),
      media(MEDIA_BREAD, KITCHEN_COOP, USER_TOM, "seed/bread.webp"),
      media(MEDIA_PILAF, KITCHEN_NAN, USER_NAN, "seed/pilaf.webp"),
      media(MEDIA_ROAST, KITCHEN_COOP, USER_TOM, "seed/roast.webp"),
      media(MEDIA_TABLE_SET, KITCHEN_SAM, USER_SAM, "seed/family_meal.webp"),
    ],
    photos: [
      photo("10000000-0000-4000-8000-000000000401", ALBUM_SUNDAY, MEDIA_TABLE_SET, KITCHEN_SAM, "Everyone squeezed onto the veranda table, Easter '26", "Apr 2026"),
      photo("10000000-0000-4000-8000-000000000402", ALBUM_SUNDAY, MEDIA_TABLE, KITCHEN_NAN, "Nan's Friday salmon — zero leftovers", "Jan 2026"),
      photo("10000000-0000-4000-8000-000000000403", ALBUM_EID, MEDIA_PILAF, KITCHEN_NAN, "The pilaf went out before the naan", "Apr 2026"),
      photo("10000000-0000-4000-8000-000000000404", ALBUM_EID, MEDIA_ROAST, KITCHEN_COOP, "Grilled chicken for the cousins who don't eat lamb", "Apr 2026"),
      photo("10000000-0000-4000-8000-000000000405", ALBUM_BAKES, MEDIA_BREAD, KITCHEN_COOP, "7am bake before the kids woke up", "Feb 2026"),
      photo("10000000-0000-4000-8000-000000000406", ALBUM_BAKES, MEDIA_TART, KITCHEN_SAM, "Claire's tart survived the car ride intact!", "Mar 2026"),
    ],
    invites: [],
    cookingEvents: [],
    exportJobs: [],
  };
}

function media(id: string, kitchenId: string, ownerId: string, storagePath: string): MediaRow {
  return {
    id,
    bookId: EXAMPLE_BOOK_ID,
    kitchenId,
    ownerId,
    storagePath,
    mime: "image/webp",
    status: "ready",
    width: 640,
    height: 480,
  };
}

function photo(
  id: string,
  albumId: string,
  mediaId: string,
  kitchenId: string,
  caption: string,
  takenOn: string,
): PhotoRow {
  return { id, bookId: EXAMPLE_BOOK_ID, albumId, mediaId, kitchenId, caption, takenOn };
}

export type DemoOptions = {
  now?: () => number;
  persistPath?: string | null;
  seedRoot?: string;
};

export class DemoRepository {
  private queue: Promise<void> = Promise.resolve();
  private readonly mediaBytes = new Map<string, Buffer>();
  private readonly pdfBytes = new Map<string, Buffer>();

  constructor(
    private state: DemoState,
    private readonly options: DemoOptions = {},
  ) {}

  static create(state: DemoState = createSeedState(), options: DemoOptions = {}): DemoRepository {
    return new DemoRepository(state, options);
  }

  static open(persistPath: string): DemoRepository {
    let state = createSeedState();
    if (existsSync(persistPath)) {
      state = JSON.parse(readFileSync(persistPath, "utf8")) as DemoState;
      const seeded = new Map(SEED_RECIPES.map((recipe) => [recipe.id, recipe.recipeBy]));
      for (const recipe of state.recipes) {
        if (typeof recipe.recipeBy === "string" && recipe.recipeBy.trim()) continue;
        recipe.recipeBy = seeded.get(recipe.id) ?? "";
      }
    }
    return new DemoRepository(state, { persistPath });
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private tx<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private persist(): void {
    if (!this.options.persistPath) return;
    mkdirSync(path.dirname(this.options.persistPath), { recursive: true });
    writeFileSync(this.options.persistPath, JSON.stringify(this.state));
  }

  private userName(userId: string | null): string {
    if (!userId) return "Someone";
    return this.state.users.find((user) => user.id === userId)?.name ?? "Someone";
  }

  private kitchen(bookId: string, kitchenId: string): KitchenRow {
    const row = this.state.kitchens.find((item) => item.id === kitchenId);
    if (!row || row.bookId !== bookId) {
      throw new AppError(409, "Cross-book link rejected");
    }
    return row;
  }

  private resolve(principal: Principal, bookId: string, intent: "read" | "write"): Resolved {
    void intent;
    const book = this.state.books.find((item) => item.id === bookId);
    if (!book) throw new AppError(404, "Book not found");
    // The link is the access. Kitchens organise recipes; they do not grant rights.
    return { book, userId: principal.userId ?? USER_PREVIEW, access: "owner" };
  }

  private kitchenRole(bookId: string, kitchenId: string, userId: string | null): KitchenRole | null {
    if (!userId) return null;
    return (
      this.state.kitchenMembers.find(
        (item) => item.bookId === bookId && item.kitchenId === kitchenId && item.userId === userId,
      )?.role ?? null
    );
  }

  private assertEditor(bookId: string, kitchenId: string, userId: string | null): void {
    void userId;
    this.kitchen(bookId, kitchenId);
  }

  private card(recipe: SeedRecipe, userId: string | null): RecipeCard {
    const kitchen = this.state.kitchens.find((item) => item.id === recipe.kitchenId);
    const favourite = userId
      ? this.state.favourites.some((item) => item.recipeId === recipe.id && item.userId === userId)
      : false;
    return {
      id: recipe.id,
      title: recipe.title,
      course: recipe.course,
      minutes: recipe.minutes,
      servings: recipe.servings,
      cookedCount: recipe.cookedCount,
      handedDownBy: recipe.handedDownBy,
      recipeBy: recipe.recipeBy ?? "",
      kitchenId: recipe.kitchenId,
      kitchenName: kitchen?.name ?? "Kitchen",
      favourite,
      heroUrl: recipe.heroMediaId ? `/api/media/${recipe.heroMediaId}` : null,
      marginNote: recipe.marginNote,
      ingredientCount: recipe.ingredients.length,
    };
  }

  private summary(book: BookRow, access: BookAccess): BookSummary {
    return {
      id: book.id,
      title: book.title,
      isExample: book.isExample,
      access,
      recipeCount: this.state.recipes.filter((recipe) => recipe.bookId === book.id && !recipe.deletedAt).length,
      kitchenCount: this.state.kitchens.filter((kitchen) => kitchen.bookId === book.id).length,
    };
  }

  upsertDemoUser(emailRaw: string): Promise<UserRow> {
    return this.tx(() => {
      const email = emailRaw.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new AppError(422, "Enter a valid email address");
      }
      const existing = this.state.users.find((user) => user.email === email);
      if (existing) return existing;
      const user = { id: randomUUID(), email, name: email.split("@")[0] ?? email };
      this.state.users.push(user);
      this.persist();
      return user;
    });
  }

  listMyBooks(principal: Principal): Promise<BookSummary[]> {
    return this.tx(() => {
      const books: BookSummary[] = [];
      if (!principal.userId) {
        return this.state.books.map((book) => this.summary(book, "owner"));
      }
      for (const book of this.state.books) {
        const member = this.state.bookMembers.find(
          (item) => item.bookId === book.id && item.userId === principal.userId,
        );
        if (member) books.push(this.summary(book, member.role));
        else if (book.isExample) books.push(this.summary(book, "guest"));
      }
      return books;
    });
  }

  getBook(principal: Principal, bookId: string): Promise<BookDetail> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "read");
      const kitchens = this.state.kitchens
        .filter((kitchen) => kitchen.bookId === bookId)
        .map((kitchen) => ({ id: kitchen.id, name: kitchen.name }));
      const myKitchenIds = resolved.userId
        ? this.state.kitchenMembers
            .filter((item) => item.bookId === bookId && item.userId === resolved.userId)
            .map((item) => item.kitchenId)
        : [];
      return {
        ...this.summary(resolved.book, resolved.access),
        kitchens,
        myKitchenIds,
        canEditTitle: resolved.access === "owner",
        canManageBook: resolved.access === "owner",
      };
    });
  }

  listRecipes(principal: Principal, bookId: string, filters: RecipeFilters = {}): Promise<RecipeCard[]> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "read");
      const query = filters.query?.trim().toLowerCase() ?? "";
      return this.state.recipes
        .filter((recipe) => recipe.bookId === bookId && !recipe.deletedAt)
        .filter((recipe) => !filters.course || filters.course === "all" || recipe.course === filters.course)
        .filter((recipe) => !filters.kitchenId || recipe.kitchenId === filters.kitchenId)
        .filter((recipe) => {
          if (!query) return true;
          const kitchen = this.state.kitchens.find((item) => item.id === recipe.kitchenId)?.name ?? "";
          const haystack = [
            recipe.title,
            recipe.handedDownBy,
            kitchen,
            ...recipe.ingredients.flatMap((ingredient) => [ingredient.item, ingredient.original_text]),
          ]
            .join("\n")
            .toLowerCase();
          return haystack.includes(query);
        })
        .sort((a, b) => b.cookedCount - a.cookedCount || a.title.localeCompare(b.title))
        .map((recipe) => this.card(recipe, resolved.userId));
    });
  }

  getRecipe(principal: Principal, bookId: string, recipeId: string): Promise<RecipeDetail> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "read");
      const recipe = this.state.recipes.find((item) => item.id === recipeId && item.bookId === bookId);
      if (!recipe) throw new AppError(404, "Recipe not found");
      const canEdit = true;
      return {
        ...this.card(recipe, resolved.userId),
        version: recipe.version,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        canEdit,
        deletedAt: recipe.deletedAt,
        bookId,
      };
    });
  }

  createBookFromDraft(
    principal: Principal,
    input: { draftKey: string; title: string; kitchenName: string },
  ): Promise<{ bookId: string; created: boolean }> {
    return this.tx(() => {
      const actor = principal.userId ?? USER_PREVIEW;
      const draftKey = requireText(input.draftKey, "Draft key", 80);
      if (draftKey.length < 8) throw new AppError(422, "Draft key is too short");
      const title = normalizeBookName(input.title);
      const kitchenName = requireText(input.kitchenName || "Our Kitchen", "Kitchen", 80);
      const existing = this.state.books.find((book) => book.draftKey === draftKey);
      if (existing) {
        if (existing.ownerId !== actor) throw new AppError(409, "Draft key conflict");
        return { bookId: existing.id, created: false };
      }
      const bookId = randomUUID();
      const kitchenId = randomUUID();
      this.state.books.push({
        id: bookId,
        title,
        ownerId: actor,
        draftKey,
        isExample: false,
        createdAt: this.now(),
      });
      this.state.bookMembers.push({ bookId, userId: actor, role: "owner" });
      this.state.kitchens.push({ id: kitchenId, bookId, name: kitchenName });
      this.state.kitchenMembers.push({ bookId, kitchenId, userId: actor, role: "lead" });
      this.persist();
      return { bookId, created: true };
    });
  }

  updateBookTitle(principal: Principal, bookId: string, title: string): Promise<void> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (resolved.access !== "owner") throw new AppError(403, "Only the book owner can rename it");
      resolved.book.title = normalizeBookName(title);
      this.persist();
    });
  }

  createRecipe(principal: Principal, bookId: string, input: RecipeInput): Promise<{ id: string }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      const clean = assertRecipeInput(input);
      this.kitchen(bookId, clean.kitchenId);
      this.assertEditor(bookId, clean.kitchenId, resolved.userId);
      const id = randomUUID();
      this.state.recipes.push({
        id,
        bookId,
        kitchenId: clean.kitchenId,
        title: clean.title,
        handedDownBy: clean.handedDownBy,
        recipeBy: clean.recipeBy,
        course: clean.course,
        minutes: clean.minutes,
        servings: clean.servings,
        marginNote: clean.marginNote,
        steps: clean.steps,
        ingredients: clean.ingredients,
        version: 1,
        deletedAt: null,
        cookedCount: 0,
        heroMediaId: null,
        createdBy: resolved.userId ?? USER_PREVIEW,
        updatedAt: this.now(),
      });
      this.persist();
      return { id };
    });
  }

  updateRecipe(
    principal: Principal,
    bookId: string,
    recipeId: string,
    version: number,
    input: RecipeInput,
  ): Promise<{ version: number }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      const recipe = this.state.recipes.find((item) => item.id === recipeId && item.bookId === bookId);
      if (!recipe || recipe.deletedAt) throw new AppError(404, "Recipe not found");
      this.assertEditor(bookId, recipe.kitchenId, resolved.userId);
      if (recipe.version !== version) throw new AppError(409, "Stale edit");
      const clean = assertRecipeInput(input);
      this.kitchen(bookId, clean.kitchenId);
      this.assertEditor(bookId, clean.kitchenId, resolved.userId);
      recipe.kitchenId = clean.kitchenId;
      recipe.title = clean.title;
      recipe.handedDownBy = clean.handedDownBy;
      recipe.recipeBy = clean.recipeBy;
      recipe.course = clean.course;
      recipe.minutes = clean.minutes;
      recipe.servings = clean.servings;
      recipe.marginNote = clean.marginNote;
      recipe.ingredients = clean.ingredients;
      recipe.steps = clean.steps;
      recipe.version += 1;
      recipe.updatedAt = this.now();
      this.persist();
      return { version: recipe.version };
    });
  }

  softDeleteRecipe(principal: Principal, bookId: string, recipeId: string): Promise<{ deletedAt: number }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      const recipe = this.state.recipes.find((item) => item.id === recipeId && item.bookId === bookId);
      if (!recipe || recipe.deletedAt) throw new AppError(404, "Recipe not found");
      this.assertEditor(bookId, recipe.kitchenId, resolved.userId);
      recipe.deletedAt = this.now();
      recipe.version += 1;
      this.persist();
      return { deletedAt: recipe.deletedAt };
    });
  }

  undoDeleteRecipe(principal: Principal, bookId: string, recipeId: string): Promise<void> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      const recipe = this.state.recipes.find((item) => item.id === recipeId && item.bookId === bookId);
      if (!recipe || !recipe.deletedAt) throw new AppError(404, "Recipe not found");
      this.assertEditor(bookId, recipe.kitchenId, resolved.userId);
      if (this.now() - recipe.deletedAt > UNDO_WINDOW_MS) {
        throw new AppError(409, "Undo window has closed");
      }
      recipe.deletedAt = null;
      recipe.version += 1;
      this.persist();
    });
  }

  setFavourite(principal: Principal, bookId: string, recipeId: string, on: boolean): Promise<void> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (!resolved.userId || resolved.access === "guest") throw new AppError(403, "Join the book to pin a favourite");
      const recipe = this.state.recipes.find((item) => item.id === recipeId && item.bookId === bookId && !item.deletedAt);
      if (!recipe) throw new AppError(404, "Recipe not found");
      const index = this.state.favourites.findIndex(
        (item) => item.recipeId === recipeId && item.userId === resolved.userId,
      );
      if (on && index < 0) {
        this.state.favourites.push({ bookId, recipeId, userId: resolved.userId });
      }
      if (!on && index >= 0) this.state.favourites.splice(index, 1);
      this.persist();
    });
  }

  incrementCooked(
    principal: Principal,
    bookId: string,
    recipeId: string,
    idempotencyKey: string,
  ): Promise<{ cookedCount: number; applied: boolean }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (!resolved.userId || resolved.access === "guest") {
        throw new AppError(403, "Join the book to record a cooking");
      }
      const key = requireText(idempotencyKey, "Idempotency key", 200);
      const recipe = this.state.recipes.find((item) => item.id === recipeId && item.bookId === bookId && !item.deletedAt);
      if (!recipe) throw new AppError(404, "Recipe not found");
      const seen = this.state.cookingEvents.some(
        (event) => event.recipeId === recipeId && event.userId === resolved.userId && event.idempotencyKey === key,
      );
      if (seen) return { cookedCount: recipe.cookedCount, applied: false };
      this.state.cookingEvents.push({
        id: randomUUID(),
        bookId,
        recipeId,
        userId: resolved.userId,
        idempotencyKey: key,
      });
      recipe.cookedCount += 1;
      this.persist();
      return { cookedCount: recipe.cookedCount, applied: true };
    });
  }

  createKitchen(principal: Principal, bookId: string, name: string): Promise<{ id: string }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (resolved.access !== "owner" || !resolved.userId) throw new AppError(403, "Only the owner can add a kitchen");
      const id = randomUUID();
      this.state.kitchens.push({ id, bookId, name: requireText(name, "Kitchen", 80) });
      this.state.kitchenMembers.push({ bookId, kitchenId: id, userId: resolved.userId, role: "lead" });
      this.persist();
      return { id };
    });
  }

  updateKitchenName(principal: Principal, bookId: string, kitchenId: string, name: string): Promise<void> {
    return this.tx(() => {
      this.resolve(principal, bookId, "write");
      const kitchen = this.kitchen(bookId, kitchenId);
      kitchen.name = normalizeBookName(name);
      this.persist();
    });
  }

  deleteKitchen(principal: Principal, bookId: string, kitchenId: string): Promise<void> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (resolved.access !== "owner") throw new AppError(403, "Only the owner can remove a kitchen");
      const kitchen = this.state.kitchens.find((item) => item.id === kitchenId && item.bookId === bookId);
      if (!kitchen) throw new AppError(404, "Kitchen not found");
      const attached =
        this.state.recipes.some((recipe) => recipe.kitchenId === kitchenId) ||
        this.state.photos.some((item) => item.kitchenId === kitchenId) ||
        this.state.media.some((item) => item.kitchenId === kitchenId && item.status !== "rejected");
      if (attached) throw new AppError(409, "This kitchen still has recipes or photos attached");
      this.state.kitchens = this.state.kitchens.filter((item) => item.id !== kitchenId);
      this.state.kitchenMembers = this.state.kitchenMembers.filter((item) => item.kitchenId !== kitchenId);
      this.state.joinRequests = this.state.joinRequests.filter((item) => item.kitchenId !== kitchenId);
      this.persist();
    });
  }

  grantKitchenMember(
    principal: Principal,
    bookId: string,
    kitchenId: string,
    userId: string,
  ): Promise<{ created: boolean }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      this.kitchen(bookId, kitchenId);
      const role = this.kitchenRole(bookId, kitchenId, resolved.userId);
      if (resolved.access !== "owner" && role !== "lead") {
        throw new AppError(403, "You cannot grant kitchen membership");
      }
      if (!principal.userId || userId === principal.userId) {
        throw new AppError(403, "You cannot grant membership to yourself");
      }
      const bookMember = this.state.bookMembers.some((item) => item.bookId === bookId && item.userId === userId);
      if (!bookMember) throw new AppError(409, "That person has not joined the book");
      const existing = this.state.kitchenMembers.find(
        (item) => item.kitchenId === kitchenId && item.userId === userId,
      );
      if (existing) return { created: false };
      this.state.kitchenMembers.push({ bookId, kitchenId, userId, role: "cook" });
      this.persist();
      return { created: true };
    });
  }

  requestJoin(principal: Principal, bookId: string, kitchenId: string): Promise<{ id: string; replayed: boolean }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (!resolved.userId || resolved.access === "guest") throw new AppError(403, "Join the book before asking for a kitchen");
      this.kitchen(bookId, kitchenId);
      if (this.kitchenRole(bookId, kitchenId, resolved.userId)) {
        throw new AppError(409, "You are already in this kitchen");
      }
      const pending = this.state.joinRequests.find(
        (item) => item.kitchenId === kitchenId && item.userId === resolved.userId && item.status === "pending",
      );
      if (pending) return { id: pending.id, replayed: true };
      const id = randomUUID();
      this.state.joinRequests.push({
        id,
        bookId,
        kitchenId,
        userId: resolved.userId,
        status: "pending",
        createdAt: this.now(),
      });
      this.persist();
      return { id, replayed: false };
    });
  }

  approveJoin(principal: Principal, requestId: string): Promise<{ replayed: boolean }> {
    return this.tx(() => this.decideJoin(principal, requestId, "approved"));
  }

  rejectJoin(principal: Principal, requestId: string): Promise<{ replayed: boolean }> {
    return this.tx(() => this.decideJoin(principal, requestId, "rejected"));
  }

  private decideJoin(principal: Principal, requestId: string, status: "approved" | "rejected"): { replayed: boolean } {
    const request = this.state.joinRequests.find((item) => item.id === requestId);
    if (!request) throw new AppError(404, "Request not found");
    const resolved = this.resolve(principal, request.bookId, "write");
    const role = this.kitchenRole(request.bookId, request.kitchenId, resolved.userId);
    if (resolved.access !== "owner" && role !== "lead") throw new AppError(403, "You cannot decide this request");
    if (principal.userId && request.userId === principal.userId) {
      throw new AppError(403, "You cannot grant membership to yourself");
    }
    if (request.status === status) return { replayed: true };
    if (request.status !== "pending") throw new AppError(409, "This request was already decided");
    request.status = status;
    if (status === "approved") {
      const exists = this.state.kitchenMembers.some(
        (item) => item.kitchenId === request.kitchenId && item.userId === request.userId,
      );
      if (!exists) {
        this.state.kitchenMembers.push({
          bookId: request.bookId,
          kitchenId: request.kitchenId,
          userId: request.userId,
          role: "cook",
        });
      }
    }
    this.persist();
    return { replayed: false };
  }

  createInvite(principal: Principal, bookId: string): Promise<{ inviteId: string; token: string }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (resolved.access !== "owner" || !resolved.userId) throw new AppError(403, "Only the owner can invite");
      const token = randomBytes(24).toString("base64url");
      const inviteId = randomUUID();
      this.state.invites.push({
        id: inviteId,
        bookId,
        tokenHash: hashToken(token),
        createdBy: resolved.userId,
        revokedAt: null,
        redeemedBy: null,
        redeemedAt: null,
        createdAt: this.now(),
      });
      this.persist();
      return { inviteId, token };
    });
  }

  revokeInvite(principal: Principal, inviteId: string): Promise<void> {
    return this.tx(() => {
      const invite = this.state.invites.find((item) => item.id === inviteId);
      if (!invite) throw new AppError(404, "Invite not found");
      const resolved = this.resolve(principal, invite.bookId, "write");
      if (resolved.access !== "owner") throw new AppError(403, "Only the owner can revoke an invite");
      invite.revokedAt = this.now();
      this.persist();
    });
  }

  redeemInvite(principal: Principal, token: string): Promise<{ bookId: string; replayed: boolean }> {
    return this.tx(() => {
      if (!principal.userId) throw new AppError(401, "Sign in required");
      const invite = this.state.invites.find((item) => item.tokenHash === hashToken(token.trim()));
      if (!invite) throw new AppError(404, "Invite not found");
      if (invite.revokedAt) throw new AppError(403, "This invite has been revoked");
      if (invite.redeemedBy && invite.redeemedBy !== principal.userId) {
        throw new AppError(403, "This invite has already been used");
      }
      if (invite.redeemedBy === principal.userId) return { bookId: invite.bookId, replayed: true };
      const member = this.state.bookMembers.find(
        (item) => item.bookId === invite.bookId && item.userId === principal.userId,
      );
      if (!member) {
        this.state.bookMembers.push({ bookId: invite.bookId, userId: principal.userId, role: "reader" });
      }
      invite.redeemedBy = principal.userId;
      invite.redeemedAt = this.now();
      this.persist();
      return { bookId: invite.bookId, replayed: false };
    });
  }

  listKitchens(principal: Principal, bookId: string): Promise<KitchenDesk> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "read");
      const kitchens = this.state.kitchens
        .filter((kitchen) => kitchen.bookId === bookId)
        .map((kitchen) => {
          const myRole = this.kitchenRole(bookId, kitchen.id, resolved.userId);
          const canSeeRequests = resolved.access === "owner" || myRole === "lead";
          const contentCount =
            this.state.recipes.filter((recipe) => recipe.kitchenId === kitchen.id).length +
            this.state.photos.filter((item) => item.kitchenId === kitchen.id).length;
          return {
            id: kitchen.id,
            name: kitchen.name,
            myRole,
            contentCount,
            members: this.state.kitchenMembers
              .filter((item) => item.kitchenId === kitchen.id)
              .map((item) => ({ userId: item.userId, name: this.userName(item.userId), role: item.role })),
            pendingRequests: canSeeRequests
              ? this.state.joinRequests
                  .filter((item) => item.kitchenId === kitchen.id && item.status === "pending")
                  .map((item) => ({ id: item.id, userId: item.userId, name: this.userName(item.userId) }))
              : [],
          };
        });
      const invites: InviteView[] =
        resolved.access === "owner"
          ? this.state.invites
              .filter((invite) => invite.bookId === bookId)
              .map((invite) => ({
                id: invite.id,
                createdAt: invite.createdAt,
                revokedAt: invite.revokedAt,
                redeemedAt: invite.redeemedAt,
                redeemedByName: invite.redeemedBy ? this.userName(invite.redeemedBy) : null,
              }))
          : [];
      return { access: resolved.access, kitchens, invites };
    });
  }

  createAlbum(principal: Principal, bookId: string, name: string): Promise<{ id: string }> {
    return this.tx(() => {
      const resolved = this.resolve(principal, bookId, "write");
      if (!resolved.userId || resolved.access === "guest") throw new AppError(403, "Join the book to add an album");
      const id = randomUUID();
      this.state.albums.push({ id, bookId, name: requireText(name, "Album", 80) });
      this.persist();
      return { id };
    });
  }

  listAlbums(principal: Principal, bookId: string): Promise<AlbumView[]> {
    return this.tx(() => {
      this.resolve(principal, bookId, "read");
      return this.state.albums
        .filter((album) => album.bookId === bookId)
        .map((album) => ({
          id: album.id,
          name: album.name,
          photos: this.state.photos
            .filter((item) => item.albumId === album.id)
            .map((item) => {
              const kitchen = this.state.kitchens.find((row) => row.id === item.kitchenId);
              return {
                id: item.id,
                mediaId: item.mediaId,
                url: `/api/media/${item.mediaId}`,
                caption: item.caption,
                meta: [kitchen?.name, item.takenOn].filter(Boolean).join(" · "),
                kitchenName: kitchen?.name ?? null,
              };
            }),
        }));
    });
  }

  async addReadyPhoto(
    principal: Principal,
    input: { bookId: string; albumId: string; kitchenId: string | null; caption: string; bytes: Uint8Array; declaredMime: string },
  ): Promise<{ photoId: string; mediaId: string }> {
    const encoded = await reencodeUpload(input.bytes, input.declaredMime);
    return this.tx(() => {
      const resolved = this.resolve(principal, input.bookId, "write");
      if (!resolved.userId || resolved.access === "guest") throw new AppError(403, "Join the book to add a photo");
      const album = this.state.albums.find((item) => item.id === input.albumId && item.bookId === input.bookId);
      if (!album) throw new AppError(404, "Album not found");
      if (input.kitchenId) {
        this.kitchen(input.bookId, input.kitchenId);
        this.assertEditor(input.bookId, input.kitchenId, resolved.userId);
      }
      const mediaId = randomUUID();
      const row: MediaRow = {
        id: mediaId,
        bookId: input.bookId,
        kitchenId: input.kitchenId,
        ownerId: resolved.userId,
        storagePath: `media/${mediaId}.jpg`,
        mime: "image/jpeg",
        status: "quarantine",
        width: 0,
        height: 0,
      };
      this.state.media.push(row);
      row.status = "ready";
      row.width = encoded.width;
      row.height = encoded.height;
      this.mediaBytes.set(mediaId, encoded.data);
      const photoId = randomUUID();
      this.state.photos.push({
        id: photoId,
        bookId: input.bookId,
        albumId: album.id,
        mediaId,
        kitchenId: input.kitchenId,
        caption: input.caption.trim().slice(0, 240),
        takenOn: new Date(this.now()).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      });
      this.persist();
      return { photoId, mediaId };
    });
  }

  readMedia(principal: Principal, mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
    return this.tx(() => {
      const asset = this.state.media.find((item) => item.id === mediaId && item.status === "ready");
      if (!asset) throw new AppError(404, "Photo not found");
      this.resolve(principal, asset.bookId, "read");
      const stored = this.mediaBytes.get(mediaId);
      if (stored) return { bytes: stored, mime: asset.mime };
      if (asset.storagePath.startsWith("seed/") && !asset.storagePath.includes("..")) {
        const file = path.join(this.options.seedRoot ?? process.cwd(), "public", asset.storagePath);
        if (!existsSync(file)) throw new AppError(404, "Photo not found");
        return { bytes: readFileSync(file), mime: asset.mime };
      }
      throw new AppError(404, "Photo not found");
    });
  }

  private snapshot(bookId: string, clothId: CoverId, bleed: boolean, embed: boolean): ExportSnapshot {
    const book = this.state.books.find((item) => item.id === bookId);
    if (!book) throw new AppError(404, "Book not found");
    const recipes = this.state.recipes
      .filter((recipe) => recipe.bookId === bookId && !recipe.deletedAt)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((recipe) => {
        const kitchen = this.state.kitchens.find((item) => item.id === recipe.kitchenId);
        return {
          id: recipe.id,
          title: recipe.title,
          course: recipe.course,
          kitchenName: kitchen?.name ?? "",
          handedDownBy: recipe.handedDownBy,
          recipeBy: recipe.recipeBy ?? "",
          minutes: recipe.minutes,
          servings: recipe.servings,
          marginNote: recipe.marginNote,
          ingredients: recipe.ingredients.map((ingredient) => {
            const qty = formatQuantity(ingredient.numerator, ingredient.denominator, ingredient.unit);
            return qty ? `${qty} ${ingredient.item}`.replace(/\s+/g, " ").trim() : ingredient.item;
          }),
          steps: [...recipe.steps],
        };
      });
    const albums = this.state.albums
      .filter((album) => album.bookId === bookId)
      .map((album) => ({
        name: album.name,
        photos: this.state.photos
          .filter((item) => item.albumId === album.id)
          .map((item) => {
            const asset = this.state.media.find((mediaRow) => mediaRow.id === item.mediaId);
            const kitchen = this.state.kitchens.find((row) => row.id === item.kitchenId);
            let src = asset ? `/api/media/${asset.id}` : "";
            if (embed && asset) {
              const bytes = this.mediaBytes.get(asset.id) ?? this.readSeed(asset.storagePath);
              src = `data:${asset.mime};base64,${bytes.toString("base64")}`;
            }
            return {
              src,
              caption: item.caption,
              meta: [kitchen?.name, item.takenOn].filter(Boolean).join(" · "),
            };
          }),
      }))
      .filter((album) => album.photos.length > 0);
    const cloth = coverById(clothId);
    return {
      version: 1,
      bookId,
      title: book.title,
      subtitle: `${recipes.length} recipes from ${this.state.kitchens.filter((item) => item.bookId === bookId).length} kitchens`,
      clothId: cloth.id,
      bleed,
      capturedAt: new Date(this.now()).toISOString(),
      recipes,
      albums,
    };
  }

  private readSeed(storagePath: string): Buffer {
    if (!storagePath.startsWith("seed/") || storagePath.includes("..")) {
      throw new AppError(404, "Photo not found");
    }
    const file = path.join(this.options.seedRoot ?? process.cwd(), "public", storagePath);
    return readFileSync(file);
  }

  buildPreviewSnapshot(principal: Principal, bookId: string, clothId: CoverId, bleed: boolean): Promise<ExportSnapshot> {
    return this.tx(() => {
      this.resolve(principal, bookId, "read");
      return this.snapshot(bookId, clothId, bleed, false);
    });
  }

  createExport(
    principal: Principal,
    bookId: string,
    options: { clothId: CoverId; bleed: boolean },
    render: (snapshot: ExportSnapshot) => Promise<Buffer>,
  ): Promise<{ jobId: string; status: "ready" | "failed"; error: string | null }> {
    return this.tx(async () => {
      const resolved = this.resolve(principal, bookId, "read");
      if (!resolved.userId) throw new AppError(401, "Sign in required");
      const snapshot = structuredClone(this.snapshot(bookId, options.clothId, options.bleed, true));
      const jobId = randomUUID();
      const job: ExportRow = {
        id: jobId,
        bookId,
        requestedBy: resolved.userId,
        status: "queued",
        snapshot,
        error: null,
        createdAt: this.now(),
      };
      this.state.exportJobs.push(job);
      try {
        const pdf = await render(structuredClone(job.snapshot));
        if (job.snapshot !== snapshot) throw new Error("snapshot mutated");
        this.pdfBytes.set(jobId, pdf);
        job.status = "ready";
      } catch (error) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : "PDF render failed";
      }
      this.persist();
      return { jobId, status: job.status, error: job.error };
    });
  }

  readExportSnapshot(principal: Principal, jobId: string): Promise<ExportSnapshot> {
    return this.tx(() => {
      const job = this.state.exportJobs.find((item) => item.id === jobId);
      if (!job) throw new AppError(404, "Export not found");
      this.resolve(principal, job.bookId, "read");
      return structuredClone(job.snapshot);
    });
  }

  readExportPdf(principal: Principal, jobId: string): Promise<{ bytes: Buffer; filename: string }> {
    return this.tx(() => {
      const job = this.state.exportJobs.find((item) => item.id === jobId);
      if (!job || job.status !== "ready") throw new AppError(404, "Export not found");
      const resolved = this.resolve(principal, job.bookId, "read");
      if (resolved.userId !== job.requestedBy && resolved.access === "guest") {
        throw new AppError(403, "You cannot download this export");
      }
      const bytes = this.pdfBytes.get(jobId);
      if (!bytes) throw new AppError(404, "Export not found");
      return { bytes, filename: `${job.snapshot.title}.pdf` };
    });
  }
}

let singleton: DemoRepository | null = null;

export function getDemoRepository(): DemoRepository {
  if (!singleton) {
    singleton = DemoRepository.open(path.join(process.cwd(), ".data", "demo-store.json"));
  }
  return singleton;
}
