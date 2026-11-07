import { cookies } from "next/headers";

import { getPrincipal } from "@/lib/auth/principal";
import { dataAdapter } from "@/lib/config";
import { isAppError } from "@/lib/errors";
import { getDemoRepository } from "@/lib/repository/demo";
import { getRepository } from "@/lib/repository";
import { contentDispositionAttachment } from "@/lib/content-disposition";
import { rateLimit } from "@/lib/rate-limit";
import { renderSnapshotPdf } from "@/lib/print/pdf-worker";
import type { CoverId, RecipeInput } from "@/lib/types";
import { COVER_CLOTHS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
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
  if (method !== "GET" && method !== "HEAD") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limit = rateLimit(`${ip}:${a ?? ""}:${method}`);
    if (!limit.ok) return json({ message: "Slow down and try again" }, 429);
  }
  const principal = await getPrincipal();
  const repo = getRepository();

  if (a === "auth" && b === "demo" && method === "POST") {
    if (dataAdapter() !== "demo") return json({ message: "Demo sign-in is off" }, 400);
    const body = await readJson<{ email?: string }>(request);
    const user = await getDemoRepository().upsertDemoUser(body.email ?? "");
    const jar = await cookies();
    jar.set("hmd_demo_uid", user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return json({ id: user.id, name: user.name });
  }

  if (a === "auth" && b === "sign-out" && method === "POST") {
    const jar = await cookies();
    jar.delete("hmd_demo_uid");
    if (dataAdapter() === "supabase") {
      const { createUserClient } = await import("@/lib/supabase/server");
      const supabase = await createUserClient();
      await supabase.auth.signOut();
    }
    return json({ ok: true });
  }

  if (a === "books" && !b && method === "POST") {
    const body = await readJson<{ draftKey: string; title: string; kitchenName: string }>(request);
    return json(await repo.createBookFromDraft(principal, body));
  }

  if (a === "books" && b && c === "recipes" && !d && method === "POST") {
    const body = await readJson<RecipeInput>(request);
    return json(await repo.createRecipe(principal, b, body), 201);
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

  if (a === "books" && b && c === "kitchens" && d && e === "members" && method === "POST") {
    const body = await readJson<{ userId: string }>(request);
    return json(await repo.grantKitchenMember(principal, b, d, body.userId));
  }

  if (a === "books" && b && c === "join-requests" && method === "POST") {
    const body = await readJson<{ kitchenId: string }>(request);
    return json(await repo.requestJoin(principal, b, body.kitchenId));
  }

  if (a === "join-requests" && b && c === "approve" && method === "POST") {
    return json(await repo.approveJoin(principal, b));
  }

  if (a === "join-requests" && b && c === "reject" && method === "POST") {
    return json(await repo.rejectJoin(principal, b));
  }

  if (a === "books" && b && c === "invites" && !d && method === "POST") {
    return json(await repo.createInvite(principal, b), 201);
  }

  if (a === "invites" && b && c === "revoke" && method === "POST") {
    await repo.revokeInvite(principal, b);
    return json({ ok: true });
  }

  if (a === "invites" && b === "redeem" && method === "POST") {
    const body = await readJson<{ token: string }>(request);
    return json(await repo.redeemInvite(principal, body.token));
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
        "cache-control": "private, max-age=3600",
      },
    });
  }

  if (a === "books" && b && c === "exports" && method === "POST") {
    const body = await readJson<{ clothId?: string; bleed?: boolean }>(request);
    const clothId = body.clothId && isCover(body.clothId) ? body.clothId : "olive";
    const result = await repo.createExport(principal, b, { clothId, bleed: Boolean(body.bleed) }, renderSnapshotPdf);
    return json(result, result.status === "ready" ? 201 : 422);
  }

  if (a === "exports" && b && method === "GET") {
    const file = await repo.readExportPdf(principal, b);
    return new Response(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": contentDispositionAttachment(file.filename),
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
