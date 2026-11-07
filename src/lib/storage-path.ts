import { AppError } from "@/lib/errors";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function mediaObjectPath(bookId: string, mediaId: string): string {
  return `book/${bookId}/${mediaId}.jpg`;
}

export function exportObjectPath(jobId: string): string {
  return `exports/${jobId}.pdf`;
}

function reject(kind: "photo" | "pdf"): never {
  throw new AppError(404, kind === "photo" ? "Photo not found" : "Export not found");
}

function isClean(path: string): boolean {
  return path.length > 0 && !path.includes("..") && !path.includes("\\") && !path.includes("\0") && !path.startsWith("/");
}

/** True only for the object this book and id own. Caller paths are never accepted. */
export function isCanonicalMediaPath(path: string, bookId: string, mediaId: string): boolean {
  if (!isClean(path)) return false;
  return path === mediaObjectPath(bookId, mediaId);
}

export function isCanonicalExportPath(path: string, jobId: string): boolean {
  if (!isClean(path)) return false;
  return path === exportObjectPath(jobId);
}

export function assertCanonicalMediaPath(path: string, bookId: string, mediaId: string): string {
  if (!new RegExp(`^book/${UUID}/${UUID}\\.jpg$`, "i").test(path)) reject("photo");
  if (!isCanonicalMediaPath(path, bookId, mediaId)) reject("photo");
  return path;
}

export function assertCanonicalExportPath(path: string, jobId: string): string {
  if (!new RegExp(`^exports/${UUID}\\.pdf$`, "i").test(path)) reject("pdf");
  if (!isCanonicalExportPath(path, jobId)) reject("pdf");
  return path;
}
