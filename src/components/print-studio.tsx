"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine, RiDownload2Line, RiPrinterLine } from "@remixicon/react";

import { BIG } from "@/components/app/screen";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Switch } from "@/components/base/switch/switch";
import { tween } from "@/components/motion";
import { paginate, type PrintPage } from "@/lib/print/paginate";
import { COVER_CLOTHS, type CoverId, type ExportSnapshot } from "@/lib/types";
import { cx } from "@/utils/cx";

export function PrintStudio({ bookId, snapshot, pdfEnabled = true }: { bookId: string; snapshot: ExportSnapshot; pdfEnabled?: boolean }) {
  const [clothId, setClothId] = useState<CoverId>(snapshot.clothId);
  const [bleed, setBleed] = useState(snapshot.bleed);
  const [spread, setSpread] = useState(0);
  const [direction, setDirection] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const opened = useRef(false);
  const pages = useMemo(() => paginate({ ...snapshot, clothId, bleed }), [snapshot, clothId, bleed]);
  // Flip animation only after the first paint, so server and client markup match.
  useEffect(() => {
    opened.current = true;
  }, []);
  const flip = opened.current;
  const spreads = Math.ceil(pages.length / 2);
  const left = pages[spread * 2];
  const right = pages[spread * 2 + 1];
  const firstShown = spread * 2 + 1;
  const lastShown = Math.min(pages.length, spread * 2 + 2);

  function go(to: number) {
    if (to < 0 || to > spreads - 1) return;
    setDirection(to >= spread ? 1 : -1);
    setSpread(to);
  }

  async function exportPdf() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/books/${bookId}/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clothId, bleed }),
      });
      const body = (await response.json()) as { jobId?: string; message?: string; error?: string; status?: string };
      if (!response.ok || !body.jobId || body.status === "failed") {
        setMessage(body.error || body.message || "The PDF worker could not render this book.");
        return;
      }
      window.location.href = `/api/exports/${body.jobId}`;
    } catch {
      setMessage("The PDF was not made. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid items-start gap-6 px-4 lg:mt-8 lg:grid-cols-[360px_1fr] lg:gap-10 lg:px-0">
      <aside className="no-print rounded-3xl bg-background-primary-default p-4 shadow-card lg:sticky lg:top-24">
        <p className="text-headline-semibold text-text-primary">Cover</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {COVER_CLOTHS.map((cloth) => (
            <button
              key={cloth.id}
              type="button"
              title={cloth.name}
              aria-label={cloth.name}
              aria-pressed={clothId === cloth.id}
              onClick={() => setClothId(cloth.id)}
              className={cx(
                "size-11 rounded-full shadow-card outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                clothId === cloth.id && "ring-2 ring-accent-500 ring-offset-2 ring-offset-background-primary-default",
              )}
              style={{ background: cloth.background }}
            />
          ))}
        </div>

        <div className="mt-5 flex min-h-11 items-center justify-between gap-3 border-t border-separator-border pt-4">
          <Switch isSelected={bleed} onChange={setBleed} className="w-full flex-row-reverse justify-between">
            <span className="text-body-medium text-text-primary">Show 3mm bleed guides</span>
          </Switch>
        </div>

        <p className="mt-3 text-body-regular text-text-secondary lg:text-headline-regular">
          {pages.length} pages, {snapshot.recipes.length} recipes, A5 {bleed ? "154 × 216mm" : "148 × 210mm"}
        </p>

        <div className="mt-5">
          {pdfEnabled ? (
            <Button leadingIcon={RiDownload2Line} disabled={busy} onClick={() => void exportPdf()} className={cx(BIG, "w-full")}>
              {busy ? "Rendering" : "Download A5 PDF"}
            </Button>
          ) : (
            <>
              <Button leadingIcon={RiPrinterLine} onClick={() => window.print()} className={cx(BIG, "w-full")}>
                Print this preview
              </Button>
              <p className="mt-2 text-caption-1-medium text-text-secondary">PDF download needs Chromium, which this host does not run.</p>
            </>
          )}
        </div>
        {message ? (
          <p role="alert" className="mt-3 rounded-2xl bg-background-tertiary-error px-4 py-3 text-body-medium text-text-error-primary">
            {message}
          </p>
        ) : null}
      </aside>

      <div className="min-w-0">
        <div className="no-print mb-3 flex items-center justify-between gap-3">
          <IconButton icon={RiArrowLeftSLine} aria-label="Previous pages" disabled={spread === 0} onClick={() => go(spread - 1)} className="size-11 rounded-full" />
          <p className="text-body-medium text-text-secondary" aria-live="polite">
            Pages {firstShown === lastShown ? firstShown : `${firstShown}-${lastShown}`} of {pages.length}
          </p>
          <IconButton
            icon={RiArrowRightSLine}
            aria-label="Next pages"
            disabled={spread >= spreads - 1}
            onClick={() => go(spread + 1)}
            className="size-11 rounded-full"
          />
        </div>
        <div style={{ perspective: "1200px" }}>
          <motion.div
            key={spread}
            className={cx(
              "grid min-w-0 overflow-hidden rounded-lg bg-background-primary-default shadow-lg lg:grid-cols-2",
              bleed && "outline-1 outline-offset-4 outline-accent-500 outline-dashed",
            )}
            initial={!reduce && flip ? { opacity: 0, rotateY: direction * 10 } : false}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={reduce ? { duration: 0 } : tween(0.3)}
          >
            {left ? <PageView page={left} /> : null}
            {right ? <PageView page={right} /> : <div className="hidden lg:block" />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const pageShell = "flex aspect-[148/210] min-w-0 flex-col justify-between overflow-hidden border-b border-separator-border p-5 lg:border-b-0 lg:border-e lg:p-8";

function PageNumber({ n }: { n: number }) {
  return <p className="text-end text-caption-1-medium text-text-tertiary">{n}</p>;
}

function PageView({ page }: { page: PrintPage }) {
  const reduce = useReducedMotion();
  if (page.kind === "cover") {
    return (
      <section className="relative aspect-[148/210] min-w-0 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={page.background}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
            style={{ background: page.background, color: page.color }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : tween(0.28)}
          >
            <h2 className="text-title-1-semibold">{page.title}</h2>
            <p className="text-body-regular opacity-80">{page.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </section>
    );
  }
  if (page.kind === "contents") {
    return (
      <section className={pageShell}>
        <div className="min-w-0">
          <p className="mb-3 text-caption-1-medium text-text-secondary">Contents</p>
          {page.entries.map((entry) => (
            <div key={entry.label} className="flex min-w-0 justify-between gap-3 border-b border-separator-border py-1.5 text-body-2-regular text-text-primary">
              <span className="truncate">{entry.label}</span>
              <span className="text-text-secondary">{entry.page}</span>
            </div>
          ))}
        </div>
        <PageNumber n={page.pageNumber} />
      </section>
    );
  }
  if (page.kind === "album") {
    return (
      <section className={pageShell}>
        <div className="min-w-0">
          <p className="text-caption-1-medium text-text-secondary">{page.album}</p>
          {page.photos.map((photo) => (
            <figure key={`${photo.src}-${photo.caption}`} className="mt-3">
              <img src={photo.src} alt="" className="aspect-[4/3] w-full rounded-sm object-cover" />
              {photo.caption ? <figcaption className="mt-1 font-hand text-title-3-medium text-accent-800">{photo.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
        <PageNumber n={page.pageNumber} />
      </section>
    );
  }
  return (
    <section className={pageShell}>
      <div className="min-w-0">
        <p className="text-caption-1-medium text-text-secondary">{page.continued ? `Continued, ${page.meta}` : page.meta}</p>
        <h2 className="mt-1 text-title-2-semibold text-text-primary">{page.title}</h2>
        {page.byline ? <p className="text-body-regular text-text-secondary">{page.byline}</p> : null}
        {page.showNote && page.note ? <p className="mt-3 font-hand text-title-3-medium text-accent-800">{page.note}</p> : null}
        <ul className="mt-3">
          {page.ingredients.map((line, index) => (
            <li key={`${index}-${line}`} className="border-b border-separator-border py-1 text-body-2-regular text-text-primary">
              {line}
            </li>
          ))}
        </ul>
        <ol className="mt-2">
          {page.steps.map((step) => (
            <li key={step.n} className="flex gap-2 border-b border-separator-border py-1 text-body-2-regular text-text-primary">
              <span className="shrink-0 text-text-secondary">{step.n}</span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </div>
      <PageNumber n={page.pageNumber} />
    </section>
  );
}
