import { paginate, type PrintPage } from "@/lib/print/paginate";
import type { ExportSnapshot } from "@/lib/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pageStyle(snapshot: ExportSnapshot): string {
  const width = snapshot.bleed ? "154mm" : "148mm";
  const height = snapshot.bleed ? "216mm" : "210mm";
  return `
    @page { size: ${width} ${height}; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .sheet {
      width: ${width};
      height: ${height};
      page-break-after: always;
      overflow: hidden;
      padding: 14mm 12mm 12mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: Georgia, "Iowan Old Style", Palatino, "Times New Roman", serif;
      color: #171614;
    }
    .sheet:last-child { page-break-after: auto; }
    .cover { text-align: center; justify-content: center; gap: 8mm; }
    .micro {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 8pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-variant-numeric: tabular-nums;
    }
    h1 { font-weight: 400; font-size: 22pt; line-height: 1.15; margin: 0; }
    h2 { font-weight: 400; font-size: 16pt; line-height: 1.2; margin: 2mm 0; }
    .byline { font-style: italic; font-size: 11pt; color: #57534e; }
    .note {
      font-family: "Segoe Script", "Comic Sans MS", cursive;
      font-size: 13pt;
      line-height: 1.3;
      background: #fbf6ea;
      border: 0.3mm solid #e5dec9;
      padding: 4mm;
      margin: 3mm 0;
    }
    ul, ol { margin: 0; padding: 0; list-style: none; }
    li { border-bottom: 0.2mm solid #e3ded4; padding: 1.6mm 0; font-size: 10pt; }
    .row { display: flex; justify-content: space-between; gap: 4mm; }
    .foot {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 8pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: right;
      margin-top: 4mm;
    }
    img { width: 100%; height: 62mm; object-fit: cover; display: block; }
    .cap { font-family: "Segoe Script", cursive; font-size: 12pt; margin-top: 2mm; }
  `;
}

function renderPage(page: PrintPage, snapshot: ExportSnapshot): string {
  const size = snapshot.bleed ? "154 × 216mm" : "148 × 210mm";
  if (page.kind === "cover") {
    return `<section class="sheet cover" style="background:${page.background};color:${page.color}">
      <div class="micro" style="color:inherit;opacity:.8">Family Edition · Vol. I</div>
      <h1>${escapeHtml(page.title)}</h1>
      <div class="byline" style="color:inherit;opacity:.85">${escapeHtml(page.subtitle)}</div>
    </section>`;
  }
  if (page.kind === "contents") {
    const rows = page.entries
      .map(
        (entry) =>
          `<li class="row"><span>${escapeHtml(entry.label)}</span><span class="micro">${String(entry.page).padStart(2, "0")}</span></li>`,
      )
      .join("");
    return `<section class="sheet"><div><div class="micro">Contents</div><ul>${rows}</ul></div><div class="foot">Page ${String(page.pageNumber).padStart(2, "0")} · A5 (${size})</div></section>`;
  }
  if (page.kind === "album") {
    const photos = page.photos
      .map((photo) => {
        const src = photo.src.startsWith("data:image/") ? photo.src : "";
        return `<figure><img src="${src}" alt=""/><div class="cap">${escapeHtml(photo.caption)}</div><div class="micro">${escapeHtml(photo.meta)}</div></figure>`;
      })
      .join("");
    return `<section class="sheet"><div><div class="micro">${escapeHtml(page.album)}</div>${photos}</div><div class="foot">Page ${String(page.pageNumber).padStart(2, "0")} · A5 (${size})</div></section>`;
  }
  const ingredients = page.ingredients
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  const steps = page.steps
    .map((step) => `<li><strong>${String(step.n).padStart(2, "0")}</strong> ${escapeHtml(step.text)}</li>`)
    .join("");
  const note = page.showNote && page.note ? `<div class="note">${escapeHtml(page.note)}</div>` : "";
  return `<section class="sheet"><div>
    <div class="micro">${escapeHtml(page.continued ? `Continued · ${page.meta}` : page.meta)}</div>
    <h2>${escapeHtml(page.title)}</h2>
    <div class="byline">${escapeHtml(page.byline)}</div>
    ${note}
    ${ingredients ? `<ul>${ingredients}</ul>` : ""}
    ${steps ? `<ol>${steps}</ol>` : ""}
  </div><div class="foot">Page ${String(page.pageNumber).padStart(2, "0")} · A5 (${size})</div></section>`;
}

export function renderPrintHtml(snapshot: ExportSnapshot): string {
  const pages = paginate(snapshot);
  const body = pages.map((page) => renderPage(page, snapshot)).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(snapshot.title)}</title><style>${pageStyle(snapshot)}</style></head><body>${body}</body></html>`;
}
