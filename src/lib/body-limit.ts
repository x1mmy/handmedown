import { AppError } from "@/lib/errors";

/**
 * Refuses bodies over `max` before they are read. Browsers send no
 * Content-Length on a bodyless DELETE, and no DELETE in this API reads a body,
 * so DELETE is exempt. Every other write must declare its size.
 */
export function assertBodyLimit(request: Request, max: number): void {
  if (request.method === "DELETE") return;
  const raw = request.headers.get("content-length");
  if (!raw) throw new AppError(411, "Content-Length is required");
  const size = Number(raw);
  if (!Number.isFinite(size) || size < 0 || size > max) throw new AppError(413, "Request is too large");
}
