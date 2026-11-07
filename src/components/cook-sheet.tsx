"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FoldedCorner, InkTick, RollingText, tween } from "@/components/motion";
import { ApiError, api } from "@/lib/client-api";
import { resolveCookedUpdate, undoToastRemaining } from "@/lib/persistence-feedback";
import { formatQuantity, scaleServings } from "@/lib/fractions";
import { COURSE_LABEL, formatMinutes } from "@/lib/format";
import type { RecipeDetail } from "@/lib/types";

export function CookSheet({ recipe }: { recipe: RecipeDetail }) {
  const router = useRouter();
  const [servings, setServings] = useState(recipe.servings);
  const [checked, setChecked] = useState<boolean[]>(() => recipe.ingredients.map(() => false));
  const [done, setDone] = useState<boolean[]>(() => recipe.steps.map(() => false));
  const [cookMode, setCookMode] = useState(false);
  const [wakeFallback, setWakeFallback] = useState(false);
  const [cooked, setCooked] = useState(recipe.cookedCount);
  const [favourite, setFavourite] = useState(recipe.favourite);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(Boolean(recipe.deletedAt));
  const [stamp, setStamp] = useState(0);
  const [stampDate, setStampDate] = useState("");
  const reduce = useReducedMotion();
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stepped = useRef(false);
  const undoTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    };
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(`hmd-checks:${recipe.id}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { checked?: boolean[]; done?: boolean[] };
      if (parsed.checked?.length === recipe.ingredients.length) setChecked(parsed.checked);
      if (parsed.done?.length === recipe.steps.length) setDone(parsed.done);
    } catch {
      sessionStorage.removeItem(`hmd-checks:${recipe.id}`);
    }
  }, [recipe.id, recipe.ingredients.length, recipe.steps.length]);

  useEffect(() => {
    sessionStorage.setItem(`hmd-checks:${recipe.id}`, JSON.stringify({ checked, done }));
  }, [checked, done, recipe.id]);

  useEffect(() => {
    if (!cookMode) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    async function acquire() {
      if (!("wakeLock" in navigator)) {
        setWakeFallback(true);
        return;
      }
      try {
        lock = await navigator.wakeLock.request("screen");
        if (stopped) await lock.release();
        else setWakeFallback(false);
      } catch {
        setWakeFallback(true);
      }
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [cookMode]);

  const activeStep = done.findIndex((item) => !item);
  const checkedCount = checked.filter(Boolean).length;

  useEffect(() => {
    if (!stepped.current) {
      stepped.current = true;
      return;
    }
    if (activeStep < 0) return;
    stepRefs.current[activeStep]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
    });
  }, [activeStep, reduce]);
  const quantities = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => {
        if (ingredient.numerator === 0) return ingredient.original_text;
        const scaled = scaleServings(ingredient.numerator, ingredient.denominator, servings, recipe.servings);
        const qty = formatQuantity(scaled.numerator, scaled.denominator, ingredient.unit);
        return qty ? `${qty}` : ingredient.item;
      }),
    [recipe.ingredients, recipe.servings, servings],
  );

  function clearUndoTimer() {
    if (undoTimer.current !== null) {
      window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }

  async function madeThis() {
    setError(null);
    const storageKey = `hmd-cook:${recipe.id}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    const previousCount = cooked;
    const previousStamp = stamp;
    const previousDate = stampDate;
    setCooked(previousCount + 1);
    setStamp(previousStamp + 1);
    setStampDate(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
    try {
      const result = await api<{ cookedCount: number; applied: boolean }>(
        `/api/books/${recipe.bookId}/recipes/${recipe.id}/cook`,
        { method: "POST", body: JSON.stringify({ idempotencyKey: key }) },
      );
      sessionStorage.removeItem(storageKey);
      const resolved = resolveCookedUpdate(result.cookedCount, result.applied);
      setCooked(resolved.count);
      if (!resolved.stamped) {
        setStamp(previousStamp);
        setStampDate(previousDate);
      }
    } catch (caught) {
      setCooked(previousCount);
      setStamp(previousStamp);
      setStampDate(previousDate);
      setError(caught instanceof ApiError ? caught.message : "Could not record this cooking");
    }
  }

  async function remove() {
    setError(null);
    try {
      const result = await api<{ deletedAt: number }>(`/api/books/${recipe.bookId}/recipes/${recipe.id}`, {
        method: "DELETE",
      });
      setDeleted(true);
      setToast(`“${recipe.title}” moved to trash.`);
      clearUndoTimer();
      const hideAt = performance.now() + undoToastRemaining(result.deletedAt, Date.now());
      undoTimer.current = window.setTimeout(() => {
        setToast(null);
        undoTimer.current = null;
      }, Math.max(0, hideAt - performance.now()));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not delete this recipe");
    }
  }

  async function undo() {
    try {
      await api(`/api/books/${recipe.bookId}/recipes/${recipe.id}/undo`, { method: "POST" });
      clearUndoTimer();
      setDeleted(false);
      setToast(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Undo window has closed");
    }
  }

  async function toggleFavourite() {
    const next = !favourite;
    setFavourite(next);
    try {
      await api(`/api/books/${recipe.bookId}/recipes/${recipe.id}/favourite`, {
        method: "POST",
        body: JSON.stringify({ on: next }),
      });
      router.refresh();
    } catch (caught) {
      setFavourite(!next);
      setError(caught instanceof ApiError ? caught.message : "Could not update the favourite");
    }
  }

  return (
    <div>
      {deleted ? (
        <p className="mb-3 text-sm" role="status">
          Moved to trash.
        </p>
      ) : null}
      <motion.div
        className="grid"
        initial={false}
        animate={{ gridTemplateRows: deleted ? "0fr" : "1fr" }}
        transition={reduce ? { duration: 0 } : tween(0.2)}
      >
        <div className="overflow-hidden">
    <article className={`relative border border-rule bg-sheet px-5 py-6 desk:px-12 desk:py-12 ${cookMode ? "cook-on" : ""}`}>
      <FoldedCorner show={favourite} />
      {stamp > 0 ? (
        <motion.p
          key={stamp}
          role="status"
          className="pointer-events-none absolute right-4 top-16 z-10 origin-center border-2 border-accent px-3 py-2 text-center text-[11px] uppercase tracking-[0.14em] text-accent"
          initial={reduce ? false : { scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : tween(0.24)}
        >
          Made
          <span className="mt-1 block tabular-nums normal-case tracking-normal">{stampDate}</span>
        </motion.p>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <p className="micro">
            {COURSE_LABEL[recipe.course]} · {recipe.kitchenName} · {formatMinutes(recipe.minutes)}
          </p>
          <h2 className="mt-1 font-serif text-[32px] font-normal leading-tight desk:text-[40px]">{recipe.title}</h2>
          {recipe.recipeBy ? <p className="font-serif italic text-inksoft">From {recipe.recipeBy}&apos;s kitchen</p> : null}
          <p className="font-serif text-[17px] italic text-inksoft">Handed down by {recipe.handedDownBy}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${line} max-w-full whitespace-normal text-center`} aria-pressed={cookMode} onClick={() => setCookMode((value) => !value)}>
            Cook mode {cookMode ? "on" : "off"}
          </button>
          <motion.button
            type="button"
            data-motion="true"
            className={`${solid} relative`}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            transition={tween(0.16)}
            onClick={() => void madeThis()}
          >
            We made this · <RollingText value={String(cooked)} />
          </motion.button>
          <button type="button" className={line} onClick={() => void toggleFavourite()}>
            {favourite ? "Pinned favourite" : "Pin favourite"}
          </button>
          {recipe.canEdit ? (
            <>
              <a href={`/books/${recipe.bookId}/recipes/${recipe.id}/edit`} className={line}>
                Edit
              </a>
              <button type="button" className={line} onClick={() => void remove()}>
                Delete
              </button>
            </>
          ) : null}
        </div>
      </header>

      {wakeFallback && cookMode ? (
        <p className="mt-4 text-sm text-inksoft">
          This browser did not grant a screen wake lock. Turn off auto-lock while you cook.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

      <div className="mt-7 grid gap-8 desk:grid-cols-[300px_1fr] desk:gap-11">
        <div>
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div>
              <div className="micro">Servings</div>
              <strong className="inline-flex items-baseline gap-2 text-lg">
                <RollingText value={String(servings)} />
                <span>servings</span>
              </strong>
            </div>
            <div className="flex gap-2">
              <button type="button" className={step} aria-label="Decrease servings" onClick={() => setServings((value) => Math.max(1, value - 1))}>
                −
              </button>
              <button type="button" className={step} aria-label="Increase servings" onClick={() => setServings((value) => Math.min(24, value + 1))}>
                +
              </button>
            </div>
          </div>
          <p className="micro mb-2 mt-4">
            {checkedCount} of {recipe.ingredients.length} ingredients checked
          </p>
          <div className="mb-3 h-0.5 overflow-hidden bg-rule">
            <motion.div
              className="h-full w-full origin-left bg-ink"
              initial={false}
              animate={{ scaleX: recipe.ingredients.length ? checkedCount / recipe.ingredients.length : 0 }}
              transition={reduce ? { duration: 0 } : tween(0.28)}
            />
          </div>
          <ul>
            {recipe.ingredients.map((ingredient, index) => (
              <li key={`${ingredient.original_text}-${index}`}>
                <button
                  type="button"
                  aria-pressed={Boolean(checked[index])}
                  onClick={() => setChecked((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)))}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-rule py-2 text-left tabular-nums [font-variant-numeric:tabular-nums_diagonal-fractions] ${
                    cookMode ? "text-[17px]" : ""
                  }`}
                >
                  <InkTick checked={Boolean(checked[index])} />
                  <span className={`relative min-w-0 flex-1 ${checked[index] ? "text-inkmuted" : ""}`}>
                    {ingredient.item}
                    <motion.span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-px w-full origin-left bg-current"
                      initial={false}
                      animate={{ scaleX: checked[index] ? 1 : 0 }}
                      transition={reduce ? { duration: 0 } : tween(0.2)}
                    />
                  </span>
                  <RollingText value={quantities[index] ?? ""} className="font-semibold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {recipe.marginNote ? (
            <div className="tape relative border border-noteborder bg-note px-4 py-3">
              <p className="font-hand text-[21px] leading-snug text-handink">&ldquo;{recipe.marginNote}&rdquo;</p>
            </div>
          ) : null}
          <p className="micro mb-2 mt-4">Tap any step as you cook. Completed steps dim.</p>
          {recipe.steps.map((stepText, index) => {
            const isDone = done[index];
            const isActive = index === activeStep;
            return (
              <motion.button
                key={stepText}
                type="button"
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
                onClick={() => setDone((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)))}
                className="relative block w-full border-b border-rule py-4 pl-4 text-left"
                initial={false}
                animate={{ opacity: isDone ? 0.5 : 1 }}
                transition={reduce ? { duration: 0 } : tween(0.2)}
              >
                <motion.span
                  aria-hidden
                  className="absolute bottom-0 left-0 top-0 w-0.5 origin-top bg-accent"
                  initial={false}
                  animate={{ scaleY: isActive ? 1 : 0 }}
                  transition={reduce ? { duration: 0 } : tween(0.2)}
                />
                <div className={`micro ${isActive ? "text-accent" : ""}`}>
                  Step {String(index + 1).padStart(2, "0")} · {isDone ? "Completed" : isActive ? "Active step" : "Waiting"}
                </div>
                <p className={cookMode ? "text-[21px] leading-relaxed" : ""}>{stepText}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

    </article>
        </div>
      </motion.div>
      <AnimatePresence>
        {toast ? (
          <motion.div
            key="undo"
            role="status"
            className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[60] mx-auto flex w-auto max-w-[calc(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right))] items-center justify-between gap-3 bg-ink px-4 py-2 text-[13px] text-sheet"
            initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={tween(0.24)}
          >
            <span>{toast}</span>
            <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#f3c6b8]" onClick={() => void undo()}>
              Undo
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const solid =
  "inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-sheet";
const line =
  "inline-flex min-h-11 items-center justify-center border border-ink bg-transparent px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-ink";
const step = "inline-flex h-11 w-11 items-center justify-center border border-ink text-lg";
