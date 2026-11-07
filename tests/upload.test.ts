import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { assertSafeImage, jpegHasExif, reencodeUpload } from "@/lib/validation/upload";
import { AppError } from "@/lib/errors";

describe("upload safety", () => {
  it("rejects svg, html, and mismatched bytes", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect(() => assertSafeImage(svg, "image/svg+xml")).toThrow(AppError);
    expect(() => assertSafeImage(html, "image/jpeg")).toThrow(AppError);
    expect(() => assertSafeImage(new Uint8Array([0, 1, 2, 3, 4]), "image/png")).toThrow(AppError);
    expect(() => assertSafeImage(new Uint8Array(8_000_001), "image/jpeg")).toThrow(AppError);
  });

  it("re-encodes a real image and strips an injected EXIF segment", async () => {
    const png = await sharp({
      create: { width: 12, height: 8, channels: 3, background: "#9E3B24" },
    })
      .png()
      .toBuffer();
    const clean = await reencodeUpload(png, "image/png");
    expect(clean.mime).toBe("image/jpeg");
    expect(clean.data[0]).toBe(0xff);
    expect(jpegHasExif(clean.data)).toBe(false);

    const payload = Buffer.from("Exif\0\0injected-gps", "latin1");
    const length = payload.length + 2;
    const segment = Buffer.concat([
      Buffer.from([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff]),
      payload,
    ]);
    const dirty = Buffer.concat([clean.data.subarray(0, 2), segment, clean.data.subarray(2)]);
    expect(jpegHasExif(dirty)).toBe(true);
    const stripped = await reencodeUpload(dirty, "image/jpeg");
    expect(jpegHasExif(stripped.data)).toBe(false);
    expect(stripped.data.includes(Buffer.from("Exif"))).toBe(false);
  });
});
