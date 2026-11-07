import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { formatQuantity } from "@/lib/fractions";
import { reencodeUpload } from "@/lib/validation/upload";
import { assertSupabaseConfigured } from "@/lib/config";
import { normalizeBookName } from "@/lib/constants";
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

async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  raise(error);
  return data as T;
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
    return { supabase: createServiceClient(), userId: "00000000-0000-4000-8000-0000000000aa" };
  }

  async listMyBooks(principal: Principal): Promise<BookSummary[]> {
    const { supabase, userId } = await this.client(principal);
    const { data: books, error } = await supabase.from("books").select("id, title, is_example");
    raise(error);
    const { data: members, error: memberError } = await supabase
      .from("book_members")
      .select("book_id, role")
      .eq("user_id", userId);
    raise(memberError);
    const { data: kitchens, error: kitchenError } = await supabase.from("kitchens").select("book_id");
    raise(kitchenError);
    const { data: recipes, error: recipeError } = await supabase.from("recipes").select("book_id, deleted_at");
    raise(recipeError);
    return (books ?? []).map((book) => {
      const role = (members ?? []).find((member) => member.book_id === book.id)?.role;
      return {
        id: book.id,
        title: book.title,
        isExample: Boolean(book.is_example),
        access: role === "owner" ? "owner" : "reader",
        recipeCount: (recipes ?? []).filter((recipe) => recipe.book_id === book.id && !recipe.deleted_at).length,
        kitchenCount: (kitchens ?? []).filter((kitchen) => kitchen.book_id === book.id).length,
      } satisfies BookSummary;
    });
  }

  async getBook(principal: Principal, bookId: string): Promise<BookDetail> {
    const { supabase, userId } = await this.client(principal);
    const { data: book, error } = await supabase
      .from("books")
      .select("id, title, is_example")
      .eq("id", bookId)
      .maybeSingle();
    raise(error);
    if (!book) throw new AppError(404, "Book not found");
    const { data: member, error: memberError } = await supabase
      .from("book_members")
      .select("role")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .maybeSingle();
    raise(memberError);
    if (!book) throw new AppError(404, "Book not found");
    const { data: kitchens, error: kitchenError } = await supabase
      .from("kitchens")
      .select("id, name")
      .eq("book_id", bookId);
    raise(kitchenError);
    const { count, error: countError } = await supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId)
      .is("deleted_at", null);
    raise(countError);
    const access = "owner" as const;
    void member;
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
    const { data, error } = await query;
    raise(error);
    const { data: kitchens, error: kitchenError } = await supabase.from("kitchens").select("id, name").eq("book_id", bookId);
    raise(kitchenError);
    const { data: favs, error: favError } = await supabase
      .from("recipe_favourites")
      .select("recipe_id")
      .eq("user_id", userId);
    raise(favError);
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
    const { supabase, userId } = await this.client(principal);
    await this.getBook(principal, bookId);
    return this.cards(supabase, userId, bookId, filters);
  }

  async getRecipe(principal: Principal, bookId: string, recipeId: string): Promise<RecipeDetail> {
    const book = await this.getBook(principal, bookId);
    const { supabase, userId } = await this.client(principal);
    const { data, error } = await supabase.from("recipes").select("*").eq("id", recipeId).eq("book_id", bookId).maybeSingle();
    raise(error);
    if (!data) throw new AppError(404, "Recipe not found");
    const recipe = data as RecipeRow;
    const match = (await this.cards(supabase, userId, bookId, {})).find((item) => item.id === recipeId);
    return {
      ...(match ?? {
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
        favourite: false,
        heroUrl: recipe.hero_media_id ? `/api/media/${recipe.hero_media_id}` : null,
        marginNote: recipe.margin_note,
        ingredientCount: recipe.ingredients_json.length,
      }),
      version: recipe.version,
      ingredients: recipe.ingredients_json,
      steps: recipe.steps_json,
      canEdit: book.myKitchenIds.includes(recipe.kitchen_id),
      deletedAt: recipe.deleted_at ? Date.parse(recipe.deleted_at) : null,
      bookId,
    };
  }

  async createBookFromDraft(
    principal: Principal,
    input: { draftKey: string; title: string; kitchenName: string },
  ): Promise<{ bookId: string; created: boolean }> {
    const { supabase } = await this.client(principal);
    const { data: existing, error } = await supabase
      .from("books")
      .select("id")
      .eq("draft_key", input.draftKey)
      .maybeSingle();
    raise(error);
    const bookId = await rpc<string>(supabase, "create_book_from_draft", {
      p_draft_key: input.draftKey,
      p_title: input.title,
      p_kitchen_name: input.kitchenName,
    });
    return { bookId, created: !existing };
  }

  async updateBookTitle(principal: Principal, bookId: string, title: string): Promise<void> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "update_book_title", { p_book_id: bookId, p_title: normalizeBookName(title) });
  }

  async createRecipe(principal: Principal, bookId: string, input: RecipeInput): Promise<{ id: string }> {
    const { supabase } = await this.client(principal);
    const id = await rpc<string>(supabase, "create_recipe", {
      p_book_id: bookId,
      p_payload: recipePayload(input),
    });
    return { id };
  }

  async updateRecipe(
    principal: Principal,
    _bookId: string,
    recipeId: string,
    version: number,
    input: RecipeInput,
  ): Promise<{ version: number }> {
    const { supabase } = await this.client(principal);
    const next = await rpc<number>(supabase, "update_recipe", {
      p_recipe_id: recipeId,
      p_version: version,
      p_patch: recipePayload(input),
    });
    return { version: next };
  }

  async softDeleteRecipe(principal: Principal, _bookId: string, recipeId: string): Promise<{ deletedAt: number }> {
    const { supabase } = await this.client(principal);
    const deletedAt = await rpc<string>(supabase, "soft_delete_recipe", { p_recipe_id: recipeId });
    const parsed = Date.parse(deletedAt);
    if (!Number.isFinite(parsed)) throw new AppError(500, "Delete did not return a database time");
    return { deletedAt: parsed };
  }

  async undoDeleteRecipe(principal: Principal, _bookId: string, recipeId: string): Promise<void> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "undo_delete_recipe", { p_recipe_id: recipeId });
  }

  async setFavourite(principal: Principal, _bookId: string, recipeId: string, on: boolean): Promise<void> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "set_favourite", { p_recipe_id: recipeId, p_on: on });
  }

  async incrementCooked(
    principal: Principal,
    _bookId: string,
    recipeId: string,
    idempotencyKey: string,
  ): Promise<{ cookedCount: number; applied: boolean }> {
    const { supabase } = await this.client(principal);
    const row = await rpc<{ cooked_count: number; applied: boolean }>(supabase, "increment_cooked", {
      p_recipe_id: recipeId,
      p_key: idempotencyKey,
    });
    return { cookedCount: row.cooked_count, applied: row.applied };
  }

  async createKitchen(principal: Principal, bookId: string, name: string): Promise<{ id: string }> {
    const { supabase } = await this.client(principal);
    const id = await rpc<string>(supabase, "create_kitchen", { p_book_id: bookId, p_name: name });
    return { id };
  }

  async updateKitchenName(principal: Principal, bookId: string, kitchenId: string, name: string): Promise<void> {
    const { supabase } = await this.client(principal);
    const { error } = await supabase
      .from("kitchens")
      .update({ name: normalizeBookName(name) })
      .eq("id", kitchenId)
      .eq("book_id", bookId);
    raise(error);
  }

  async deleteKitchen(principal: Principal, _bookId: string, kitchenId: string): Promise<void> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "delete_kitchen", { p_kitchen_id: kitchenId });
  }

  async grantKitchenMember(
    principal: Principal,
    _bookId: string,
    kitchenId: string,
    userId: string,
  ): Promise<{ created: boolean }> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "grant_kitchen_member", { p_kitchen_id: kitchenId, p_user_id: userId });
    return { created: true };
  }

  async requestJoin(principal: Principal, _bookId: string, kitchenId: string): Promise<{ id: string; replayed: boolean }> {
    const { supabase } = await this.client(principal);
    const id = await rpc<string>(supabase, "request_kitchen_join", { p_kitchen_id: kitchenId });
    return { id, replayed: false };
  }

  async approveJoin(principal: Principal, requestId: string): Promise<{ replayed: boolean }> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "approve_kitchen_join", { p_request_id: requestId });
    return { replayed: false };
  }

  async rejectJoin(principal: Principal, requestId: string): Promise<{ replayed: boolean }> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "reject_kitchen_join", { p_request_id: requestId });
    return { replayed: false };
  }

  async createInvite(principal: Principal, bookId: string): Promise<{ inviteId: string; token: string }> {
    const { supabase } = await this.client(principal);
    const row = await rpc<{ id: string; token: string }>(supabase, "create_book_invite", { p_book_id: bookId });
    return { inviteId: row.id, token: row.token };
  }

  async revokeInvite(principal: Principal, inviteId: string): Promise<void> {
    const { supabase } = await this.client(principal);
    await rpc(supabase, "revoke_book_invite", { p_invite_id: inviteId });
  }

  async redeemInvite(principal: Principal, token: string): Promise<{ bookId: string; replayed: boolean }> {
    const { supabase } = await this.client(principal);
    const bookId = await rpc<string>(supabase, "redeem_invite", { p_token: token });
    return { bookId, replayed: false };
  }

  async listKitchens(principal: Principal, bookId: string): Promise<KitchenDesk> {
    const book = await this.getBook(principal, bookId);
    const { supabase } = await this.client(principal);
    const { data: members, error } = await supabase
      .from("kitchen_members")
      .select("kitchen_id, user_id, role")
      .eq("book_id", bookId);
    raise(error);
    const { data: requests, error: requestError } = await supabase
      .from("kitchen_join_requests")
      .select("id, kitchen_id, user_id, status")
      .eq("book_id", bookId)
      .eq("status", "pending");
    raise(requestError);
    const { data: recipes, error: recipeError } = await supabase.from("recipes").select("kitchen_id").eq("book_id", bookId);
    raise(recipeError);
    const { data: photos, error: photoError } = await supabase.from("album_photos").select("kitchen_id").eq("book_id", bookId);
    raise(photoError);
    const { data: invites, error: inviteError } = await supabase
      .from("book_invites")
      .select("id, created_at, revoked_at, redeemed_at, redeemed_by")
      .eq("book_id", bookId);
    raise(inviteError);
    return {
      access: book.access,
      kitchens: book.kitchens.map((kitchen) => ({
        id: kitchen.id,
        name: kitchen.name,
        myRole: (members ?? []).find((member) => member.kitchen_id === kitchen.id && book.myKitchenIds.includes(kitchen.id) && member.user_id === principal.userId)?.role ?? null,
        contentCount:
          (recipes ?? []).filter((recipe) => recipe.kitchen_id === kitchen.id).length +
          (photos ?? []).filter((photo) => photo.kitchen_id === kitchen.id).length,
        members: (members ?? [])
          .filter((member) => member.kitchen_id === kitchen.id)
          .map((member) => ({ userId: member.user_id, name: member.user_id.slice(0, 8), role: member.role })),
        pendingRequests:
          book.access === "owner"
            ? (requests ?? [])
                .filter((request) => request.kitchen_id === kitchen.id)
                .map((request) => ({ id: request.id, userId: request.user_id, name: request.user_id.slice(0, 8) }))
            : [],
      })),
      invites:
        book.access === "owner"
          ? (invites ?? []).map((invite) => ({
              id: invite.id,
              createdAt: Date.parse(invite.created_at),
              revokedAt: invite.revoked_at ? Date.parse(invite.revoked_at) : null,
              redeemedAt: invite.redeemed_at ? Date.parse(invite.redeemed_at) : null,
              redeemedByName: invite.redeemed_by,
            }))
          : [],
    };
  }

  async createAlbum(principal: Principal, bookId: string, name: string): Promise<{ id: string }> {
    const { supabase } = await this.client(principal);
    const id = await rpc<string>(supabase, "create_album", { p_book_id: bookId, p_name: name });
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
    const encoded = await reencodeUpload(input.bytes, input.declaredMime);
    const { supabase, userId } = await this.client(principal);
    const mediaId = await rpc<string>(supabase, "create_media_asset", {
      p_book_id: input.bookId,
      p_kitchen_id: input.kitchenId,
      p_mime: "image/jpeg",
    });
    const storagePath = mediaObjectPath(input.bookId, mediaId);
    try {
      const service = createServiceClient();
      const uploaded = await service.storage.from("media").upload(storagePath, encoded.data, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploaded.error) throw new AppError(400, uploaded.error.message);
      await rpc(service, "mark_media_ready", {
        p_media_id: mediaId,
        p_width: encoded.width,
        p_height: encoded.height,
        p_path: storagePath,
      });
    } catch (error) {
      await rpc(supabase, "reject_media", { p_media_id: mediaId }).catch(() => undefined);
      throw error;
    }
    const photoId = await rpc<string>(supabase, "attach_album_photo", {
      p_album_id: input.albumId,
      p_media_id: mediaId,
      p_caption: input.caption,
      p_kitchen_id: input.kitchenId,
    });
    void userId;
    return { photoId, mediaId };
  }

  async readMedia(principal: Principal, mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
    const { supabase } = await this.client(principal);
    const { data, error } = await supabase
      .from("media_assets")
      .select("storage_path, mime, status, book_id")
      .eq("id", mediaId)
      .eq("status", "ready")
      .maybeSingle();
    raise(error);
    if (!data) throw new AppError(404, "Photo not found");
    const path = assertCanonicalMediaPath(data.storage_path, data.book_id, mediaId);
    const service = createServiceClient();
    const downloaded = await service.storage.from("media").download(path);
    if (downloaded.error || !downloaded.data) throw new AppError(404, "Photo not found");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    return { bytes, mime: data.mime };
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
    const book = await this.getBook(principal, bookId);
    const recipes = await this.listRecipes(principal, bookId, {});
    const albums = await this.listAlbums(principal, bookId);
    const detailed = await Promise.all(recipes.map((recipe) => this.getRecipe(principal, bookId, recipe.id)));
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
                let src = photo.url;
                if (embed) {
                  const file = await this.readMedia(principal, photo.mediaId);
                  src = `data:${file.mime};base64,${file.bytes.toString("base64")}`;
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
    const { supabase } = await this.client(principal);
    const snapshot = await this.capture(principal, bookId, options.clothId, options.bleed, true);
    const frozen = structuredClone(snapshot);
    const jobId = await rpc<string>(supabase, "create_export_job", {
      p_book_id: bookId,
      p_snapshot: frozen,
    });
    try {
      const pdf = await render(structuredClone(frozen));
      const service = createServiceClient();
      const pdfPath = exportObjectPath(jobId);
      const uploaded = await service.storage.from("media").upload(pdfPath, pdf, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploaded.error) throw new AppError(400, uploaded.error.message);
      const serviceJobs = createServiceClient();
      await rpc(serviceJobs, "finish_export_job", {
        p_job_id: jobId,
        p_status: "ready",
        p_pdf_path: pdfPath,
        p_error: null,
      });
      return { jobId, status: "ready", error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF render failed";
      await rpc(createServiceClient(), "finish_export_job", {
        p_job_id: jobId,
        p_status: "failed",
        p_pdf_path: null,
        p_error: message,
      }).catch(() => undefined);
      return { jobId, status: "failed", error: message };
    }
  }

  async readExportPdf(principal: Principal, jobId: string): Promise<{ bytes: Buffer; filename: string }> {
    const { supabase } = await this.client(principal);
    const { data, error } = await supabase
      .from("export_jobs")
      .select("pdf_path, status, snapshot")
      .eq("id", jobId)
      .maybeSingle();
    raise(error);
    if (!data || data.status !== "ready" || !data.pdf_path) throw new AppError(404, "Export not found");
    const path = assertCanonicalExportPath(data.pdf_path, jobId);
    const service = createServiceClient();
    const downloaded = await service.storage.from("media").download(path);
    if (downloaded.error || !downloaded.data) throw new AppError(404, "Export not found");
    const snapshot = data.snapshot as ExportSnapshot;
    return {
      bytes: Buffer.from(await downloaded.data.arrayBuffer()),
      filename: `${snapshot.title}.pdf`,
    };
  }
}
