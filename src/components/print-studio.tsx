"use client";

import { useMemo, useState } from "react";

import { paginate } from "@/lib/print/paginate";
import { COVER_CLOTHS, type CoverId, type ExportSnapshot } from "@/lib/types";

export function PrintStudio({ bookId, snapshot }: { bookId: string; snapshot: ExportSnapshot }) {
  const [clothId, setClothId] = useState<CoverId>(snapshot.clothId);
  const [bleed, setBleed] = useState(snapshot.bleed);
  const [spread, setSpread] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pages = useMemo(() => paginate({ ...snapshot, clothId, bleed }), [snapshot, clothId, bleed]);
  const left = pages[spread * 2];
  const right = pages[spread * 2 + 1];
  const spreads = Math.ceil(pages.length / 2);

  async function exportPdf() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/books/${bookId}/exports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clothId, bleed }),
    });
    const body = (await response.json()) as { jobId?: string; message?: string; error?: string; status?: string };
    if (!response.ok || !body.jobId || body.status === "failed") {
      setMessage(body.error || body.message || "The PDF worker could not render this book.");
      setBusy(false);
      return;
    }
    window.location.href = `/api/exports/${body.jobId}`;
    setBusy(false);
  }

  return (
    <div className="grid min-w-0 items-start gap-8 desk:grid-cols-[290px_1fr]">
      <aside className="border border-rule bg-sheet p-5">
        <p className="micro">A5 bound book export</p>
        <h3 className="mt-1 font-serif text-2xl font-normal">Print configuration</h3>
        <p className="micro mt-4">Bookcloth linen cover</p>
        <div className="mt-2 flex gap-2.5">
          {COVER_CLOTHS.map((cloth) => (
            <button
              key={cloth.id}
              type="button"
              title={cloth.name}
              aria-label={cloth.name}
              aria-pressed={clothId === cloth.id}
              onClick={() => setClothId(cloth.id)}
              className={`h-11 w-11 border border-ink ${clothId === cloth.id ? "outline outline-2 outline-offset-2 outline-ink" : ""}`}
              style={{ background: cloth.background }}
            />
          ))}
        </div>
        <button type="button" className="mt-5 flex min-h-11 w-full min-w-0 items-center justify-center whitespace-normal border border-ink px-3 text-center text-[12px] uppercase leading-snug tracking-[0.08em]" onClick={() => setBleed((value) => !value)}>
          {bleed ? "Hide" : "Show"} 3mm bleed guides
        </button>
        <p className="micro my-4">
          {pages.length} pages · {snapshot.recipes.length} recipes · A5 {bleed ? "154×216mm" : "148×210mm"}
        </p>
        <button type="button" disabled={busy} onClick={() => void exportPdf()} className="flex min-h-11 w-full min-w-0 items-center justify-center whitespace-normal border border-ink bg-ink px-3 text-center text-[12px] uppercase leading-snug tracking-[0.08em] text-sheet disabled:opacity-50">
          {busy ? "Rendering" : "Export print-ready A5 PDF"}
        </button>
        {message ? <p className="mt-3 text-sm text-accent">{message}</p> : null}
        <div className="mt-4 flex w-full min-w-0 gap-2">
          <button type="button" className="min-h-11 flex-1 border border-rule" onClick={() => setSpread((value) => Math.max(0, value - 1))}>
            Previous
          </button>
          <button type="button" className="min-h-11 flex-1 border border-rule" onClick={() => setSpread((value) => Math.min(spreads - 1, value + 1))}>
            Next
          </button>
        </div>
      </aside>
      <div className={`grid min-w-0 bg-sheet ${bleed ? "outline outline-1 outline-offset-2 outline-dashed outline-accent" : ""} desk:grid-cols-2 ${bleed ? "" : "border border-[#cfc8ba]"}`}>
        {left ? <PageView page={left} /> : null}
        {right ? <PageView page={right} /> : <div className="hidden desk:block" />}
      </div>
    </div>
  );
}

function PageView({ page }: { page: ReturnType<typeof paginate>[number] }) {
  if (page.kind === "cover") {
    return (
      <section className="flex aspect-[148/210] min-w-0 flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: page.background, color: page.color }}>
        <p className="micro" style={{ color: "inherit" }}>Family edition · Vol. I</p>
        <h2 className="font-serif text-[28px] font-normal leading-tight">{page.title}</h2>
        <p className="font-serif text-sm italic opacity-80">{page.subtitle}</p>
      </section>
    );
  }
  if (page.kind === "contents") {
    return (
      <section className="flex aspect-[148/210] min-w-0 flex-col justify-between border-b border-rule p-5 desk:border-b-0 desk:border-r">
        <div className="min-w-0">
          <p className="micro mb-3">Contents</p>
          {page.entries.map((entry) => (
            <div key={entry.label} className="flex min-w-0 justify-between gap-3 border-b border-rule py-1.5 text-[13px]">
              <span>{entry.label}</span>
              <span className="micro">{String(entry.page).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
        <p className="micro text-right">Page {String(page.pageNumber).padStart(2, "0")} · A5 (148 × 210mm)</p>
      </section>
    );
  }
  if (page.kind === "album") {
    return (
      <section className="flex aspect-[148/210] flex-col justify-between border-b border-rule p-5 desk:border-b-0 desk:border-r">
        <div>
          <p className="micro">{page.album}</p>
          {page.photos.map((photo) => (
            <figure key={photo.caption} className="mt-3">
              <img src={photo.src} alt="" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="mt-1 font-hand text-lg">{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
        <p className="micro text-right">Page {String(page.pageNumber).padStart(2, "0")}</p>
      </section>
    );
  }
  return (
    <section className="flex aspect-[148/210] flex-col justify-between overflow-hidden border-b border-rule p-5 desk:border-b-0 desk:border-r">
      <div>
        <p className="micro">{page.continued ? `Continued · ${page.meta}` : page.meta}</p>
        <h2 className="mt-1 font-serif text-2xl font-normal leading-tight">{page.title}</h2>
        <p className="font-serif text-sm italic text-inksoft">{page.byline}</p>
        {page.showNote && page.note ? <p className="mt-3 font-hand text-lg leading-snug text-handink">{page.note}</p> : null}
        <ul className="mt-3">
          {page.ingredients.map((line) => (
            <li key={line} className="border-b border-rule py-1 text-[13px]">{line}</li>
          ))}
        </ul>
        <ol className="mt-2">
          {page.steps.map((step) => (
            <li key={step.n} className="border-b border-rule py-1 text-[13px]">
              <span className="micro mr-2">{String(step.n).padStart(2, "0")}</span>
              {step.text}
            </li>
          ))}
        </ol>
      </div>
      <p className="micro text-right">Page {String(page.pageNumber).padStart(2, "0")} · A5 (148 × 210mm)</p>
    </section>
  );
}
