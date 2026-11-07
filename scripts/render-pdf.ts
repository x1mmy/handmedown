import { readFileSync, writeFileSync } from "node:fs";
import { renderSnapshotPdf } from "../src/lib/print/pdf-worker";
import type { ExportSnapshot } from "../src/lib/types";

async function main() {
  const input = process.argv[2];
  const output = process.argv[3] ?? "hand-me-down.pdf";
  if (!input) {
    console.error("Usage: tsx scripts/render-pdf.ts snapshot.json [out.pdf]");
    process.exit(1);
  }
  const snapshot = JSON.parse(readFileSync(input, "utf8")) as ExportSnapshot;
  const pdf = await renderSnapshotPdf(snapshot);
  writeFileSync(output, pdf);
  console.log(`Wrote ${output} (${pdf.length} bytes)`);
}

void main();
