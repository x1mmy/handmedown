import { NextRequest } from "next/server";

import { getPrincipal } from "@/lib/auth/principal";
import { assertSharedBook } from "@/lib/book-scope";
import { pdfExportEnabled } from "@/lib/config";
import { AppError, isAppError } from "@/lib/errors";
import { getRepository } from "@/lib/repository";
import { contentDispositionAttachment } from "@/lib/content-disposition";
import { beginExport } from "@/lib/export-guard";
import { MAX_JSON_BYTES, MAX_UPLOAD_REQUEST_BYTES } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { renderSnapshotPdf } from "@/lib/print/pdf-worker";
import type { CoverId, RecipeInput } from "@/lib/types";
import { COVER_CLOTHS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "x-content-type-options": "nosniff" } });
}

function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel.slice(0, 80);
  const ip = (request as NextRequest & { ip?: string }).ip;
  if (ip) return ip.slice(0, 80);
  return "local";
}

function assertBodyLimit(request: Request, max: number): void {
  const raw = request.headers.get("content-length");
  if (!raw) throw new AppError(411, "Content-Length is required");
  const size = Number(raw);
  if (!Number.isFinite(size) || size < 0 || size > max) throw new AppError(413, "Request is too large");
}

function fail(error: unknown): Response {
  if (isAppError(error)) return json({ message: error.message }, error.status);
  console.error(error);
  return json({ message: "Something went wrong" }, 500);
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

function isCover(value: string): value is CoverId {
  return COVER_CLOTHS.some((cloth) => cloth.id === value);
}

async function dispatch(request: Request, slug: string[]): Promise<Response> {
  const method = request.method;
  const [a, b, c, d, e] = slug;
  if (a === "auth" || a === "invites" || a === "join-requests" || c === "members" || c === "join-requests" || c === "invites") {
    return json({ message: "Not found" }, 404);
  }
  const ip = clientIp(request);
  if (method !== "GET" && method !== "HEAD") {
    const limit = rateLimit(`${ip}:${a ?? ""}:${method}`);
    if (!limit.ok) return json({ message: "Slow down and try again" }, 429);
    const upload = a === "books" && (c === "media" || (c === "recipes" && e === "photo"));
    assertBodyLimit(request, upload ? MAX_UPLOAD_REQUEST_BYTES : MAX_JSON_BYTES);
  }
  const principal = await getPrincipal();
  const repo = getRepository();
  if (a === "books" && b) assertSharedBook(b);

  if (a === "books" && !b && method === "POST") {
    return json(await repo.createBookFromDraft(principal, { draftKey: "shared-book", title: "The Fam", kitchenName: "Our Kitchen" }));
  }

  if (a === "books" && b && c === "recipes" && !d && method === "POST") {
    const body = await readJson<RecipeInput>(request);
    return json(await repo.createRecipe(principal, b, body), 201);
  }

  if (a === "books" && b && c === "recipes" && d && e === "photo" && method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ message: "Choose a photo" }, 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    return json(await repo.setRecipePhoto(principal, b, d, { bytes, declaredMime: file.type || "application/octet-stream" }), 201);
  }

  if (a === "books" && b && c === "recipes" && d && e === "photo" && method === "DELETE") {
    await repo.clearRecipePhoto(principal, b, d);
    return json({ ok: true });
  }

  if (a === "books" && b && c === "recipes" && d && !e && method === "PATCH") {
    const body = await readJson<RecipeInput & { version: number }>(request);
    return json(await repo.updateRecipe(principal, b, d, body.version, body));
  }

  if (a === "books" && b && c === "recipes" && d && !e && method === "DELETE") {
    return json(await repo.softDeleteRecipe(principal, b, d));
  }

  if (a === "books" && b && c === "recipes" && d && e === "undo" && method === "POST") {
    await repo.undoDeleteRecipe(principal, b, d);
    return json({ ok: true });
  }

  if (a === "books" && b && c === "recipes" && d && e === "favourite" && method === "POST") {
    const body = await readJson<{ on: boolean }>(request);
    await repo.setFavourite(principal, b, d, Boolean(body.on));
    return json({ ok: true });
  }

  if (a === "books" && b && c === "recipes" && d && e === "cook" && method === "POST") {
    const body = await readJson<{ idempotencyKey: string }>(request);
    return json(await repo.incrementCooked(principal, b, d, body.idempotencyKey));
  }

  if (a === "books" && b && !c && method === "PATCH") {
    const body = await readJson<{ title: string }>(request);
    await repo.updateBookTitle(principal, b, body.title);
    return json({ ok: true });
  }

  if (a === "books" && b && c === "kitchens" && !d && method === "POST") {
    const body = await readJson<{ name: string }>(request);
    return json(await repo.createKitchen(principal, b, body.name), 201);
  }

  if (a === "books" && b && c === "kitchens" && d && !e && method === "PATCH") {
    const body = await readJson<{ name: string }>(request);
    await repo.updateKitchenName(principal, b, d, body.name);
    return json({ ok: true, name: body.name });
  }

  if (a === "books" && b && c === "kitchens" && d && !e && method === "DELETE") {
    await repo.deleteKitchen(principal, b, d);
    return json({ ok: true });
  }

  if (a === "books" && b && c === "albums" && method === "POST") {
    const body = await readJson<{ name: string }>(request);
    return json(await repo.createAlbum(principal, b, body.name), 201);
  }

  if (a === "books" && b && c === "media" && method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ message: "Choose a photo" }, 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kitchenId = String(form.get("kitchenId") ?? "") || null;
    return json(
      await repo.addReadyPhoto(principal, {
        bookId: b,
        albumId: String(form.get("albumId") ?? ""),
        kitchenId,
        caption: String(form.get("caption") ?? ""),
        bytes,
        declaredMime: file.type || "application/octet-stream",
      }),
      201,
    );
  }

  if (a === "media" && b && method === "GET") {
    const media = await repo.readMedia(principal, b);
    return new Response(new Uint8Array(media.bytes), {
      status: 200,
      headers: {
        "content-type": media.mime,
        // A media id never changes its bytes, so the phone can keep it.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (a === "books" && b && c === "exports" && method === "POST") {
    if (!pdfExportEnabled()) {
      return json({ message: "Use your browser's print dialog. This host cannot run the PDF worker." }, 422);
    }
    const body = await readJson<{ clothId?: string; bleed?: boolean }>(request);
    const clothId = body.clothId && isCover(body.clothId) ? body.clothId : "olive";
    const finish = beginExport(ip);
    try {
      const result = await repo.createExport(principal, b, { clothId, bleed: Boolean(body.bleed) }, renderSnapshotPdf);
      return json(result, result.status === "ready" ? 201 : 422);
    } finally {
      finish();
    }
  }

  if (a === "exports" && b && method === "GET") {
    const file = await repo.readExportPdf(principal, b);
    return new Response(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": contentDispositionAttachment(file.filename),
        "x-content-type-options": "nosniff",
      },
    });
  }

  return json({ message: "Not found" }, 404);
}

async function entry(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await dispatch(request, slug);
  } catch (error) {
    if (error instanceof Error && "status" in error && (error as { status?: number }).status === 400) {
      return json({ message: "Invalid JSON" }, 400);
    }
    return fail(error);
  }
}

export const GET = entry;
export const POST = entry;
export const PATCH = entry;
export const DELETE = entry;
