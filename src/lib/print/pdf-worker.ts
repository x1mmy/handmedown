import { renderPrintHtml } from "@/lib/print/render-html";
import type { ExportSnapshot } from "@/lib/types";

/**
 * Renders an immutable export snapshot to an A5 PDF.
 * The browser context aborts every network request. The HTML is self-contained.
 */
export function assertOfflinePrintHtml(html: string): void {
  if (/https?:\/\//i.test(html) || /url\s*\(\s*['"]?\s*\/\//i.test(html)) {
    throw new Error("Print HTML must not reference network URLs");
  }
}

export async function renderSnapshotPdf(snapshot: ExportSnapshot): Promise<Buffer> {
  const html = renderPrintHtml(snapshot);
  assertOfflinePrintHtml(html);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext();
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const width = snapshot.bleed ? "154mm" : "148mm";
    const height = snapshot.bleed ? "216mm" : "210mm";
    const pdf = await page.pdf({
      width,
      height,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
