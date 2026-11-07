import { AppError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

export type ImageKind = "jpeg" | "png" | "webp";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((value, index) => bytes[index] === value);
}

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

function headText(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, 512));
  return new TextDecoder("utf-8", { fatal: false }).decode(slice).toLowerCase();
}

function looksTextual(bytes: Uint8Array): boolean {
  const head = headText(bytes).trimStart();
  return (
    head.startsWith("<svg") ||
    head.startsWith("<?xml") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<script") ||
    head.startsWith("%pdf") ||
    head.includes("<script") ||
    head.includes("<svg")
  );
}

export function assertSafeImage(bytes: Uint8Array, declaredMime: string): ImageKind {
  const mime = declaredMime.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppError(422, "Unsafe upload rejected");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError(422, "Unsafe upload rejected");
  }
  if (looksTextual(bytes)) {
    throw new AppError(422, "Unsafe upload rejected");
  }
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    throw new AppError(422, "Unsafe upload rejected");
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    throw new AppError(422, "Unsafe upload rejected");
  }
  const kind = sniffImage(bytes);
  if (!kind) throw new AppError(422, "Unsafe upload rejected");
  if (mime === "image/png" && kind !== "png") throw new AppError(422, "Unsafe upload rejected");
  if ((mime === "image/jpeg" || mime === "image/jpg") && kind !== "jpeg") {
    throw new AppError(422, "Unsafe upload rejected");
  }
  if (mime === "image/webp" && kind !== "webp") throw new AppError(422, "Unsafe upload rejected");
  return kind;
}

export function jpegHasExif(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  if (text.includes("Exif")) return true;
  for (let i = 0; i < bytes.length - 3 && i < 65536; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) return true;
  }
  return false;
}

export type ReencodedImage = {
  data: Buffer;
  width: number;
  height: number;
  mime: "image/jpeg";
};

export async function reencodeUpload(bytes: Uint8Array, declaredMime: string): Promise<ReencodedImage> {
  assertSafeImage(bytes, declaredMime);
  const sharp = (await import("sharp")).default;
  let result: { data: Buffer; info: { width: number; height: number } };
  try {
    result = await sharp(bytes, {
      failOn: "error",
      animated: false,
      limitInputPixels: 40_000_000,
      pages: 1,
    })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError(422, "Unsafe upload rejected");
  }
  if (jpegHasExif(result.data)) {
    throw new AppError(422, "Could not strip image metadata");
  }
  if (result.data[0] !== 0xff || result.data[1] !== 0xd8) {
    throw new AppError(422, "Unsafe upload rejected");
  }
  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
    mime: "image/jpeg",
  };
}
