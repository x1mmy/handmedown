import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { randomUUID } from "node:crypto";

import { assertSharedBook, sharedBookId } from "@/lib/book-scope";
import { AppError } from "@/lib/errors";
import { formatQuantity } from "@/lib/fractions";
import { reencodeUpload } from "@/lib/validation/upload";
import { assertSupabaseConfigured, pdfExportEnabled } from "@/lib/config";
import { normalizeBookName, UNDO_WINDOW_MS } from "@/lib/constants";
import { MAX_ALBUMS, MAX_EMBEDDED_PHOTOS, MAX_KITCHENS, MAX_PHOTOS, MAX_RECIPES, MAX_SNAPSHOT_CHARS, SHARED_FAVOURITE_USER } from "@/lib/limits";
import { assertCanonicalExportPath, assertCanonicalMediaPath, exportObjectPath, mediaObjectPath } from "@/lib/storage-path";
import { createServiceClient } from "@/lib/supabase/server";
import {
  COURSES,
  coverById,
  type AlbumView,
  type BookDetail,
  type BookSummary,
  type CoverId,
  type ExportSnapshot,
  type KitchenDesk,
  type Principal,
  type RecipeCard,
  type RecipeDetail,
  type RecipeFilters,
  type RecipeInput,
} from "@/lib/types";

type DbError = { code?: string; message?: string } | null;

function raise(error: DbError): void {
  if (!error) return;
  const message = error.message ?? "Request failed";
  const code = error.code ?? "";
  if (code === "28000" || /sign in required/i.test(message)) throw new AppError(401, message);
  if (code === "42501" || code === "PGRST301") throw new AppError(403, message);
  if (code === "P0002" || code === "PGRST116") throw new AppError(404, message);
  if (code === "H4090" || code === "23503" || code === "23505" || code === "40001") {
    throw new AppError(409, code === "23503" ? "Cross-book link rejected" : message);
  }
  throw new AppError(400, message);
}

function recipePayload(input: RecipeInput) {
  if (!COURSES.includes(input.course)) throw new AppError(422, "Choose a course");
  return {
    kitchen_id: input.kitchenId,
    title: input.title,
    handed_down_by: input.handedDownBy,
    recipe_by: input.recipeBy ?? "",
    course: input.course,
    minutes: input.minutes,
    servings: input.servings,
    margin_note: input.marginNote,
    ingredients_json: input.ingredients,
    steps_json: input.steps,
  };
}

type RecipeRow = {
  id: string;
  book_id: string;
  kitchen_id: string;
  title: string;
  handed_down_by: string;
  recipe_by: string | null;
  course: RecipeCard["course"];
  minutes: number;
  servings: number;
  margin_note: string;
  steps_json: string[];
  ingredients_json: RecipeDetail["ingredients"];
  version: number;
  deleted_at: string | null;
  cooked_count: number;
  hero_media_id: string | null;
};

export class SupabaseRepository {
  private async client(principal: Principal): Promise<{ supabase: SupabaseClient; userId: string }> {
    void principal;
    assertSupabaseConfigured();
    return { supabase: createServiceClient(), userId: SHARED_FAVOURITE_USER };
  }

  async listMyBooks(principal: Principal): Promise<BookSummary[]> {
    const book = await this.getBook(principal, sharedBookId());
    return [
      {
        id: book.id,
        title: book.title,
        isExample: book.isExample,
        access: "owner",
        recipeCount: book.recipeCount,
        kitchenCount: book.kitchenCount,
      },
    ];
  }

  async getBook(principal: Principal, bookId: string): Promise<BookDetail> {
    assertSharedBook(bookId);
    const { supabase } = await this.client(principal);
    // One round trip: the three reads run in parallel.
    const [bookResult, kitchenResult, countResult] = await Promise.all([
      supabase.from("books").select("id, title, is_example").eq("id", bookId).maybeSingle(),
      supabase.from("kitchens").select("id, name").eq("book_id", bookId),
      supabase.from("recipes").select("id", { count: "exact", head: true }).eq("book_id", bookId).is("deleted_at", null),
    ]);
    raise(bookResult.error);
    raise(kitchenResult.error);
    raise(countResult.error);
    const book = bookResult.data;
    if (!book) throw new AppError(404, "Book not found");
    const kitchens = kitchenResult.data;
    const count = countResult.count;
    const access = "owner" as const;
    return {
      id: book.id,
      title: book.title,
      isExample: Boolean(book.is_example),
      access,
      recipeCount: count ?? 0,
      kitchenCount: kitchens?.length ?? 0,
      kitchens: (kitchens ?? []).map((kitchen) => ({ id: kitchen.id, name: kitchen.name })),
      myKitchenIds: (kitchens ?? []).map((kitchen) => kitchen.id),
      canEditTitle: access === "owner",
      canManageBook: access === "owner",
    };
  }

  private async cards(
    supabase: SupabaseClient,
    userId: string,
    bookId: string,
    filters: RecipeFilters,
  ): Promise<RecipeCard[]> {
    let query = supabase.from("recipes").select("*").eq("book_id", bookId).is("deleted_at", null);
    if (filters.course && filters.course !== "all") query = query.eq("course", filters.course);
    if (filters.kitchenId) query = query.eq("kitchen_id", filters.kitchenId);
    const [recipeResult, kitchenResult, favResult] = await Promise.all([
      query,
      supabase.from("kitchens").select("id, name").eq("book_id", bookId),
      supabase.from("recipe_favourites").select("recipe_id").eq("book_id", bookId).eq("user_id", userId),
    ]);
    raise(recipeResult.error);
    raise(kitchenResult.error);
    raise(favResult.error);
    const data = recipeResult.data;
    const kitchens = kitchenResult.data;
    const favs = favResult.data;
    const names = new Map((kitchens ?? []).map((kitchen) => [kitchen.id, kitchen.name]));
    const favouriteIds = new Set((favs ?? []).map((item) => item.recipe_id));
    const needle = filters.query?.trim().toLowerCase() ?? "";
    return ((data ?? []) as RecipeRow[])
      .filter((recipe) => {
        if (!needle) return true;
        const kitchen = names.get(recipe.kitchen_id) ?? "";
        const haystack = [
          recipe.title,
          recipe.handed_down_by,
          kitchen,
          ...(recipe.ingredients_json ?? []).flatMap((ingredient) => [ingredient.item, ingredient.original_text]),
        ]
          .join("\n")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => b.cooked_count - a.cooked_count || a.title.localeCompare(b.title))
      .map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        course: recipe.course,
        minutes: recipe.minutes,
        servings: recipe.servings,
        cookedCount: recipe.cooked_count,
        handedDownBy: recipe.handed_down_by,
        recipeBy: recipe.recipe_by ?? "",
        kitchenId: recipe.kitchen_id,
        kitchenName: names.get(recipe.kitchen_id) ?? "Kitchen",
        favourite: favouriteIds.has(recipe.id),
        heroUrl: recipe.hero_media_id ? `/api/media/${recipe.hero_media_id}` : null,
        marginNote: recipe.margin_note,
        ingredientCount: recipe.ingredients_json?.length ?? 0,
      }));
  }

  async listRecipes(principal: Principal, bookId: string, filters: RecipeFilters = {}): Promise<RecipeCard[]> {
    assertSharedBook(bookId);
    const { supabase, userId } = await this.client(principal);
    return this.cards(supabase, userId, bookId, filters);
  }

  async getRecipe(principal: Principal, bookId: string, recipeId: string): Promise<RecipeDetail> {
    assertSharedBook(bookId);
    const { supabase, userId } = await this.client(principal);
    // Book, recipe and favourite flag in one parallel round trip.
    const [book, recipeResult, favResult] = await Promise.all([
      this.getBook(principal, bookId),
      supabase.from("recipes").select("*").eq("id", recipeId).eq("book_id", bookId).maybeSingle(),
      supabase.from("recipe_favourites").select("recipe_id").eq("book_id", bookId).eq("recipe_id", recipeId).eq("user_id", userId).maybeSingle(),
    ]);
    raise(recipeResult.error);
    raise(favResult.error);
    if (!recipeResult.data) throw new AppError(404, "Recipe not found");
    const recipe = recipeResult.data as RecipeRow;
    return toDetail(recipe, book, Boolean(favResult.data));
  }


  async createBookFromDraft(
    principal: Principal,
    input: { draftKey: string; title: string; kitchenName: string },
  ): Promise<{ bookId: string; created: boolean }> {
    void input;
    const bookId = sharedBookId();
    const { supabase } = await this.client(principal);
    const { data: existing, error } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
    raise(error);
    if (existing) return { bookId, created: false };
    const inserted = await supabase.from("books").insert({ id: bookId, title: "The Fam", is_example: true });
    raise(inserted.error);
    const kitchen = await supabase.from("kitchens").insert({
      id: "10000000-0000-4000-8000-000000000011",
      book_id: bookId,
      name: "Our Kitchen",
    });
    raise(kitchen.error);
    return { bookId, created: true };
  }

  async updateBookTitle(principal: Principal, bookId: string, title: string): Promise<void> {
    assertSharedBook(bookId);
    const { supabase } = await this.client(principal);
    const { data, error } = await supabase
      .from("books")
      .update({ title: normalizeBookName(title) })
      .eq("id", bookId)
      .select("id");
    raise(error);
    if (!data?.length) throw new AppError(404, "Book not found");
  }

  private async requireRecipe(supabase: SupabaseClient, bookId: string, recipeId: string): Promise<RecipeRow> {
    assertSharedBook(bookId);
    const { data, error } = await supabase.from("recipes").select("*").eq("id", recipeId).eq("book_id", bookId).maybeSingle();
    raise(error);
    if (!data) throw new AppError(404, "Recipe not found");
    return data as RecipeRow;
  }

  async createRecipe(principal: Principal, bookId: string, input: RecipeInput): Promise<{ id: string }> {
    assertSharedBook(bookId);
    const book = await this.getBook(principal, bookId);
    if (book.recipeCount >= MAX_RECIPES) throw new AppError(422, "This book has enough recipes");
    if (!book.kitchens.some((kitchen) => kitchen.id === input.kitchenId)) throw new AppError(409, "Cross-book link rejected");
    if (input.ingredients.length > 80 || input.steps.length > 40) throw new AppError(422, "That recipe is too long");
    const { supabase } = await this.client(principal);
    const id = randomUUID();
    const { error } = await supabase.from("recipes").insert({ id, book_id: bookId, ...recipePayload(input), version: 1 });
    raise(error);
    return { id };
  }

  async updateRecipe(
    principal: Principal,
    bookId: string,
    recipeId: string,
    version: number,
    input: RecipeInput,
  ): Promise<{ version: number }> {
    const { supabase } = await this.client(principal);
    const current = await this.requireRecipe(supabase, bookId, recipeId);
    if (! (await this.getBook(principal, bookId)).kitchens.some((kitchen) => kitchen.id === input.kitchenId)) {
      throw new AppError(409, "Cross-book link rejected");
    }
    if (current.version !== version) throw new AppError(409, "Someone else saved this recipe");
    const next = version + 1;
    const { data, error } = await supabase
      .from("recipes")
      .update({ ...recipePayload(input), version: next, updated_at: new Date().toISOString() })
      .eq("id", recipeId)
      .eq("book_id", bookId)
      .eq("version", version)
      .select("version");
    raise(error);
    if (!data?.length) throw new AppError(409, "Someone else saved this recipe");
    return { version: next };
  }

  async softDeleteRecipe(principal: Principal, bookId: string, recipeId: string): Promise<{ deletedAt: number }> {
    const { supabase } = await this.client(principal);
    await this.requireRecipe(supabase, bookId, recipeId);
    const deletedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("recipes")
      .update({ deleted_at: deletedAt })
      .eq("id", recipeId)
      .eq("book_id", bookId)
      .is("deleted_at", null)
      .select("deleted_at");
    raise(error);
    const stamp = data?.[0]?.deleted_at ? Date.parse(data[0].deleted_at) : Date.parse(deletedAt);
    if (!Number.isFinite(stamp)) throw new AppError(500, "Delete did not return a database time");
    return { deletedAt: stamp };
  }

  async undoDeleteRecipe(principal: Principal, bookId: string, recipeId: string): Promise<void> {
    const { supabase } = await this.client(principal);
    const recipe = await this.requireRecipe(supabase, bookId, recipeId);
    const deletedAt = recipe.deleted_at ? Date.parse(recipe.deleted_at) : NaN;
    if (!Number.isFinite(deletedAt) || Date.now() > deletedAt + UNDO_WINDOW_MS) {
      throw new AppError(409, "Undo window has closed");
    }
    const { error } = await supabase.from("recipes").update({ deleted_at: null }).eq("id", recipeId).eq("book_id", bookId);
    raise(error);
  }

  async setFavourite(principal: Principal, bookId: string, recipeId: string, on: boolean): Promise<void> {
    const { supabase, userId } = await this.client(principal);
    await this.requireRecipe(supabase, bookId, recipeId);
    if (on) {
      const { error } = await supabase.from("recipe_favourites").upsert(
        { book_id: bookId, recipe_id: recipeId, user_id: userId },
        { onConflict: "recipe_id,user_id" },
      );
      raise(error);
      return;
    }
    const { error } = await supabase.from("recipe_favourites").delete().eq("book_id", bookId).eq("recipe_id", recipeId).eq("user_id", userId);
    raise(error);
  }

  async incrementCooked(
    principal: Principal,
    bookId: string,
    recipeId: string,
    idempotencyKey: string,
  ): Promise<{ cookedCount: number; applied: boolean }> {
    const key = idempotencyKey.trim().slice(0, 80);
    if (!key) throw new AppError(422, "Missing cook key");
    const { supabase, userId } = await this.client(principal);
    const recipe = await this.requireRecipe(supabase, bookId, recipeId);
    const inserted = await supabase.from("cooking_events").insert({
      book_id: bookId,
      recipe_id: recipeId,
      user_id: userId,
      idempotency_key: key,
    });
    if (inserted.error?.code === "23505") return { cookedCount: recipe.cooked_count, applied: false };
    raise(inserted.error);
    const next = recipe.cooked_count + 1;
    const { error } = await supabase.from("recipes").update({ cooked_count: next }).eq("id", recipeId).eq("book_id", bookId);
    raise(error);
    return { cookedCount: next, applied: true };
  }

  async createKitchen(principal: Principal, bookId: string, name: string): Promise<{ id: string }> {
    const book = await this.getBook(principal, bookId);
    if (book.kitchenCount >= MAX_KITCHENS) throw new AppError(422, "This book has enough kitchens");
    const { supabase } = await this.client(principal);
    const id = randomUUID();
    const { error } = await supabase.from("kitchens").insert({ id, book_id: bookId, name: normalizeBookName(name) });
    raise(error);
    return { id };
  }

  async updateKitchenName(principal: Principal, bookId: string, kitchenId: string, name: string): Promise<void> {
    assertSharedBook(bookId);
    const { supabase } = await this.client(principal);
    const { data, error } = await supabase
      .from("kitchens")
      .update({ name: normalizeBookName(name) })
      .eq("id", kitchenId)
      .eq("book_id", bookId)
      .select("id");
    raise(error);
    if (!data?.length) throw new AppError(404, "Kitchen not found");
  }

  async deleteKitchen(principal: Principal, bookId: string, kitchenId: string): Promise<void> {
    assertSharedBook(bookId);
    const { supabase } = await this.client(principal);
    const { count: recipes, error: recipeError } = await supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId)
      .eq("kitchen_id", kitchenId);
    raise(recipeError);
    const { count: photos, error: photoError } = await supabase
      .from("album_photos")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId)
      .eq("kitchen_id", kitchenId);
    raise(photoError);
    if ((recipes ?? 0) + (photos ?? 0) > 0) throw new AppError(409, "This kitchen still has recipes or photos attached");
    const { data, error } = await supabase.from("kitchens").delete().eq("id", kitchenId).eq("book_id", bookId).select("id");
    raise(error);
    if (!data?.length) throw new AppError(404, "Kitchen not found");
  }

  async grantKitchenMember(principal: Principal, bookId: string, kitchenId: string, userId: string): Promise<{ created: boolean }> {
    void principal;
    void bookId;
    void kitchenId;
    void userId;
    throw new AppError(404, "Not found");
  }

  async requestJoin(principal: Principal, bookId: string, kitchenId: string): Promise<{ id: string; replayed: boolean }> {
    void principal;
    void bookId;
    void kitchenId;
    throw new AppError(404, "Not found");
  }

  async approveJoin(principal: Principal, requestId: string): Promise<{ replayed: boolean }> {
    void principal;
    void requestId;
    throw new AppError(404, "Not found");
  }

  async rejectJoin(principal: Principal, requestId: string): Promise<{ replayed: boolean }> {
    void principal;
    void requestId;
    throw new AppError(404, "Not found");
  }

  async createInvite(principal: Principal, bookId: string): Promise<{ inviteId: string; token: string }> {
    void principal;
    void bookId;
    throw new AppError(404, "Not found");
  }

  async revokeInvite(principal: Principal, inviteId: string): Promise<void> {
    void principal;
    void inviteId;
    throw new AppError(404, "Not found");
  }

  async redeemInvite(principal: Principal, token: string): Promise<{ bookId: string; replayed: boolean }> {
    void principal;
    void token;
    throw new AppError(404, "Not found");
  }

  async listKitchens(principal: Principal, bookId: string): Promise<KitchenDesk> {
    const book = await this.getBook(principal, bookId);
    const { supabase } = await this.client(principal);
    const { data: recipes, error: recipeError } = await supabase.from("recipes").select("kitchen_id").eq("book_id", bookId);
    raise(recipeError);
    const { data: photos, error: photoError } = await supabase.from("album_photos").select("kitchen_id").eq("book_id", bookId);
    raise(photoError);
    return {
      access: book.access,
      kitchens: book.kitchens.map((kitchen) => ({
        id: kitchen.id,
        name: kitchen.name,
        myRole: "lead" as const,
        contentCount:
          (recipes ?? []).filter((recipe) => recipe.kitchen_id === kitchen.id).length +
          (photos ?? []).filter((photo) => photo.kitchen_id === kitchen.id).length,
        members: [],
        pendingRequests: [],
      })),
      invites: [],
    };
  }

  async createAlbum(principal: Principal, bookId: string, name: string): Promise<{ id: string }> {
    const { supabase } = await this.client(principal);
    await this.getBook(principal, bookId);
    const { count, error: countError } = await supabase.from("albums").select("id", { count: "exact", head: true }).eq("book_id", bookId);
    raise(countError);
    if ((count ?? 0) >= MAX_ALBUMS) throw new AppError(422, "This book has enough albums");
    const id = randomUUID();
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) throw new AppError(422, "Album name is required");
    const { error } = await supabase.from("albums").insert({ id, book_id: bookId, name: trimmed });
    raise(error);
    return { id };
  }

  async listAlbums(principal: Principal, bookId: string): Promise<AlbumView[]> {
    await this.getBook(principal, bookId);
    const { supabase } = await this.client(principal);
    const { data: albums, error } = await supabase.from("albums").select("id, name").eq("book_id", bookId);
    raise(error);
    const { data: photos, error: photoError } = await supabase
      .from("album_photos")
      .select("id, album_id, media_id, caption, taken_on, kitchen_id")
      .eq("book_id", bookId);
    raise(photoError);
    const { data: kitchens, error: kitchenError } = await supabase.from("kitchens").select("id, name").eq("book_id", bookId);
    raise(kitchenError);
    const names = new Map((kitchens ?? []).map((kitchen) => [kitchen.id, kitchen.name]));
    return (albums ?? []).map((album) => ({
      id: album.id,
      name: album.name,
      photos: (photos ?? [])
        .filter((photo) => photo.album_id === album.id)
        .map((photo) => ({
          id: photo.id,
          mediaId: photo.media_id,
          url: `/api/media/${photo.media_id}`,
          caption: photo.caption ?? "",
          meta: [names.get(photo.kitchen_id), photo.taken_on].filter(Boolean).join(" · "),
          kitchenName: names.get(photo.kitchen_id) ?? null,
        })),
    }));
  }

  async addReadyPhoto(
    principal: Principal,
    input: { bookId: string; albumId: string; kitchenId: string | null; caption: string; bytes: Uint8Array; declaredMime: string },
  ): Promise<{ photoId: string; mediaId: string }> {
    assertSharedBook(input.bookId);
    const encoded = await reencodeUpload(input.bytes, input.declaredMime);
    const { supabase } = await this.client(principal);
    const { count, error: countError } = await supabase
      .from("album_photos")
      .select("id", { count: "exact", head: true })
      .eq("book_id", input.bookId);
    raise(countError);
    if ((count ?? 0) >= MAX_PHOTOS) throw new AppError(422, "This book has enough photographs");
    const { data: album, error: albumError } = await supabase
      .from("albums")
      .select("id")
      .eq("id", input.albumId)
      .eq("book_id", input.bookId)
      .maybeSingle();
    raise(albumError);
    if (!album) throw new AppError(404, "Album not found");
    if (input.kitchenId) {
      const { data: kitchen, error: kitchenError } = await supabase
        .from("kitchens")
        .select("id")
        .eq("id", input.kitchenId)
        .eq("book_id", input.bookId)
        .maybeSingle();
      raise(kitchenError);
      if (!kitchen) throw new AppError(409, "Cross-book link rejected");
    }
    const mediaId = await this.storeImage(supabase, input.bookId, input.kitchenId, encoded);
    const photoId = randomUUID();
    const attached = await supabase.from("album_photos").insert({
      id: photoId,
      book_id: input.bookId,
      album_id: input.albumId,
      media_id: mediaId,
      kitchen_id: input.kitchenId,
      caption: input.caption.trim().slice(0, 240),
    });
    raise(attached.error);
    return { photoId, mediaId };
  }

  /** Quarantine row, private Storage upload, then mark ready. Rejects the row if any step fails. */
  private async storeImage(
    supabase: SupabaseClient,
    bookId: string,
    kitchenId: string | null,
    encoded: Awaited<ReturnType<typeof reencodeUpload>>,
  ): Promise<string> {
    const mediaId = randomUUID();
    const created = await supabase.from("media_assets").insert({
      id: mediaId,
      book_id: bookId,
      kitchen_id: kitchenId,
      mime: "image/jpeg",
      status: "quarantine",
      storage_path: "",
    });
    raise(created.error);
    const storagePath = mediaObjectPath(bookId, mediaId);
    try {
      const service = createServiceClient();
      const uploaded = await service.storage.from("media").upload(storagePath, encoded.data, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploaded.error) throw new AppError(400, uploaded.error.message);
      const ready = await supabase
        .from("media_assets")
        .update({ status: "ready", width: encoded.width, height: encoded.height, storage_path: storagePath, mime: "image/jpeg" })
        .eq("id", mediaId)
        .eq("book_id", bookId)
        .eq("status", "quarantine")
        .select("id");
      raise(ready.error);
      if (!ready.data?.length) throw new AppError(404, "Photo not found");
    } catch (error) {
      await supabase.from("media_assets").update({ status: "rejected" }).eq("id", mediaId).eq("book_id", bookId);
      throw error;
    }
    return mediaId;
  }

  async setRecipePhoto(
    principal: Principal,
    bookId: string,
    recipeId: string,
    input: { bytes: Uint8Array; declaredMime: string },
  ): Promise<{ mediaId: string; heroUrl: string }> {
    assertSharedBook(bookId);
    const encoded = await reencodeUpload(input.bytes, input.declaredMime);
    const { supabase } = await this.client(principal);
    const recipe = await this.requireRecipe(supabase, bookId, recipeId);
    // No sign-in, so storage needs a hard ceiling: album photos plus one cover per recipe.
    const { count, error: countError } = await supabase
      .from("media_assets")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId)
      .neq("status", "rejected");
    raise(countError);
    if ((count ?? 0) >= MAX_PHOTOS + MAX_RECIPES) throw new AppError(422, "This book has enough photographs");
    const mediaId = await this.storeImage(supabase, bookId, recipe.kitchen_id, encoded);
    const { data, error } = await supabase
      .from("recipes")
      .update({ hero_media_id: mediaId, updated_at: new Date().toISOString() })
      .eq("id", recipeId)
      .eq("book_id", bookId)
      .select("id");
    raise(error);
    if (!data?.length) throw new AppError(404, "Recipe not found");
    if (recipe.hero_media_id && recipe.hero_media_id !== mediaId) await this.releaseMedia(supabase, bookId, recipe.hero_media_id);
    return { mediaId, heroUrl: `/api/media/${mediaId}` };
  }

  async clearRecipePhoto(principal: Principal, bookId: string, recipeId: string): Promise<void> {
    assertSharedBook(bookId);
    const { supabase } = await this.client(principal);
    const recipe = await this.requireRecipe(supabase, bookId, recipeId);
    const { error } = await supabase
      .from("recipes")
      .update({ hero_media_id: null, updated_at: new Date().toISOString() })
      .eq("id", recipeId)
      .eq("book_id", bookId);
    raise(error);
    if (recipe.hero_media_id) await this.releaseMedia(supabase, bookId, recipe.hero_media_id);
  }

  /**
   * Deletes a replaced cover photo's object and row, unless an album photo
   * still uses it. Best effort: a failed cleanup never fails the user's save.
   */
  private async releaseMedia(supabase: SupabaseClient, bookId: string, mediaId: string): Promise<void> {
    try {
      const { count, error } = await supabase
        .from("album_photos")
        .select("id", { count: "exact", head: true })
        .eq("book_id", bookId)
        .eq("media_id", mediaId);
      raise(error);
      if ((count ?? 0) > 0) return;
      const removed = await createServiceClient().storage.from("media").remove([mediaObjectPath(bookId, mediaId)]);
      if (removed.error) throw removed.error;
      const deleted = await supabase.from("media_assets").delete().eq("id", mediaId).eq("book_id", bookId);
      if (deleted.error) {
        await supabase.from("media_assets").update({ status: "rejected" }).eq("id", mediaId).eq("book_id", bookId);
      }
    } catch (caught) {
      console.error("Could not release replaced photo", mediaId, caught);
    }
  }

  async readMedia(principal: Principal, mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
    const { supabase } = await this.client(principal);
    void principal;
    const { data, error } = await supabase
      .from("media_assets")
      .select("storage_path, mime, status, book_id")
      .eq("id", mediaId)
      .eq("status", "ready")
      .maybeSingle();
    raise(error);
    if (!data || data.book_id !== sharedBookId()) throw new AppError(404, "Photo not found");
    const path = assertCanonicalMediaPath(data.storage_path, data.book_id, mediaId);
    const service = createServiceClient();
    const downloaded = await service.storage.from("media").download(path);
    if (downloaded.error || !downloaded.data) throw new AppError(404, "Photo not found");
    return { bytes: Buffer.from(await downloaded.data.arrayBuffer()), mime: data.mime };
  }

  async buildPreviewSnapshot(principal: Principal, bookId: string, clothId: CoverId, bleed: boolean): Promise<ExportSnapshot> {
    return this.capture(principal, bookId, clothId, bleed, false);
  }

  private async capture(
    principal: Principal,
    bookId: string,
    clothId: CoverId,
    bleed: boolean,
    embed: boolean,
  ): Promise<ExportSnapshot> {
    const { supabase } = await this.client(principal);
    // One parallel batch instead of a query per recipe.
    const [book, rowsResult, albums] = await Promise.all([
      this.getBook(principal, bookId),
      supabase.from("recipes").select("*").eq("book_id", bookId).is("deleted_at", null),
      this.listAlbums(principal, bookId),
    ]);
    raise(rowsResult.error);
    const detailed = ((rowsResult.data ?? []) as RecipeRow[]).map((row) => toDetail(row, book, false));
    const recipes = detailed;
    let embedded = 0;
    return {
      version: 1,
      bookId,
      title: book.title,
      subtitle: `${recipes.length} recipes from ${book.kitchenCount} kitchens`,
      clothId: coverById(clothId).id,
      bleed,
      capturedAt: new Date().toISOString(),
      recipes: detailed
        .filter((recipe) => !recipe.deletedAt)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((recipe) => ({
          id: recipe.id,
          title: recipe.title,
          course: recipe.course,
          kitchenName: recipe.kitchenName,
          handedDownBy: recipe.handedDownBy,
          recipeBy: recipe.recipeBy,
          minutes: recipe.minutes,
          servings: recipe.servings,
          marginNote: recipe.marginNote,
          ingredients: recipe.ingredients.map((ingredient) => {
            const qty = formatQuantity(ingredient.numerator, ingredient.denominator, ingredient.unit);
            return qty ? `${qty} ${ingredient.item}`.replace(/\s+/g, " ").trim() : ingredient.item;
          }),
          steps: recipe.steps,
        })),
      albums: await Promise.all(
        albums
          .filter((album) => album.photos.length > 0)
          .map(async (album) => ({
            name: album.name,
            photos: await Promise.all(
              album.photos.map(async (photo) => {
                let src = "";
                if (embed && embedded < MAX_EMBEDDED_PHOTOS) {
                  const file = await this.readMedia(principal, photo.mediaId);
                  src = `data:${file.mime};base64,${file.bytes.toString("base64")}`;
                  embedded += 1;
                }
                return { src, caption: photo.caption, meta: photo.meta };
              }),
            ),
          })),
      ),
    };
  }

  async createExport(
    principal: Principal,
    bookId: string,
    options: { clothId: CoverId; bleed: boolean },
    render: (snapshot: ExportSnapshot) => Promise<Buffer>,
  ): Promise<{ jobId: string; status: "ready" | "failed"; error: string | null }> {
    if (!pdfExportEnabled()) {
      return { jobId: "", status: "failed", error: "Use your browser's print dialog. This host cannot run the PDF worker." };
    }
    const { supabase } = await this.client(principal);
    const renderSnapshot = await this.capture(principal, bookId, options.clothId, options.bleed, true);
    const frozen = structuredClone(renderSnapshot);
    for (const album of frozen.albums) {
      for (const photo of album.photos) photo.src = "";
    }
    if (JSON.stringify(frozen).length > MAX_SNAPSHOT_CHARS) throw new AppError(422, "This book is too large to export");
    const jobId = randomUUID();
    const created = await supabase.from("export_jobs").insert({
      id: jobId,
      book_id: bookId,
      status: "queued",
      snapshot: frozen,
    });
    raise(created.error);
    try {
      const pdf = await render(structuredClone(renderSnapshot));
      const service = createServiceClient();
      const pdfPath = exportObjectPath(jobId);
      const uploaded = await service.storage.from("media").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
      if (uploaded.error) throw new AppError(400, uploaded.error.message);
      const finished = await supabase
        .from("export_jobs")
        .update({ status: "ready", pdf_path: pdfPath, error: null })
        .eq("id", jobId)
        .eq("book_id", bookId);
      raise(finished.error);
      return { jobId, status: "ready", error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF render failed";
      await supabase.from("export_jobs").update({ status: "failed", pdf_path: null, error: message }).eq("id", jobId).eq("book_id", bookId);
      return { jobId, status: "failed", error: message };
    }
  }

  async readExportPdf(principal: Principal, jobId: string): Promise<{ bytes: Buffer; filename: string }> {
    const { supabase } = await this.client(principal);
    const { data, error } = await supabase
      .from("export_jobs")
      .select("pdf_path, status, snapshot, book_id")
      .eq("id", jobId)
      .maybeSingle();
    raise(error);
    if (!data || data.book_id !== sharedBookId() || data.status !== "ready" || !data.pdf_path) throw new AppError(404, "Export not found");
    const path = assertCanonicalExportPath(data.pdf_path, jobId);
    const service = createServiceClient();
    const downloaded = await service.storage.from("media").download(path);
    if (downloaded.error || !downloaded.data) throw new AppError(404, "Export not found");
    const snapshot = data.snapshot as ExportSnapshot;
    return { bytes: Buffer.from(await downloaded.data.arrayBuffer()), filename: `${snapshot.title}.pdf` };
  }
}

/** One recipe row to the detail shape the cook view and print share. */
function toDetail(recipe: RecipeRow, book: BookDetail, favourite: boolean): RecipeDetail {
  return {
    id: recipe.id,
    title: recipe.title,
    course: recipe.course,
    minutes: recipe.minutes,
    servings: recipe.servings,
    cookedCount: recipe.cooked_count,
    handedDownBy: recipe.handed_down_by,
    recipeBy: recipe.recipe_by ?? "",
    kitchenId: recipe.kitchen_id,
    kitchenName: book.kitchens.find((kitchen) => kitchen.id === recipe.kitchen_id)?.name ?? "Kitchen",
    favourite,
    heroUrl: recipe.hero_media_id ? `/api/media/${recipe.hero_media_id}` : null,
    marginNote: recipe.margin_note,
    ingredientCount: recipe.ingredients_json?.length ?? 0,
    version: recipe.version,
    ingredients: recipe.ingredients_json ?? [],
    steps: recipe.steps_json ?? [],
    canEdit: book.myKitchenIds.includes(recipe.kitchen_id),
    deletedAt: recipe.deleted_at ? Date.parse(recipe.deleted_at) : null,
    bookId: book.id,
  };
}
