/** ASCII fallback plus RFC 5987 filename*. Control characters are stripped. */
export function contentDispositionAttachment(filename: string): string {
  const stripped = filename.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "hand-me-down.pdf";
  const ascii = stripped.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "download.pdf";
  const encoded = encodeURIComponent(stripped).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
