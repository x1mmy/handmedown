"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/client-api";
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

  async function madeThis() {
    setError(null);
    const storageKey = `hmd-cook:${recipe.id}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    try {
      const result = await api<{ cookedCount: number }>(
        `/api/books/${recipe.bookId}/recipes/${recipe.id}/cook`,
        { method: "POST", body: JSON.stringify({ idempotencyKey: key }) },
      );
      sessionStorage.removeItem(storageKey);
      setCooked(result.cookedCount);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not record this cooking");
    }
  }

  async function remove() {
    setError(null);
    try {
      await api(`/api/books/${recipe.bookId}/recipes/${recipe.id}`, { method: "DELETE" });
      setDeleted(true);
      setToast(`“${recipe.title}” moved to trash.`);
      window.setTimeout(() => setToast(null), 6000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not delete this recipe");
    }
  }

  async function undo() {
    try {
      await api(`/api/books/${recipe.bookId}/recipes/${recipe.id}/undo`, { method: "POST" });
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
    <article className={`border border-rule bg-sheet px-5 py-6 desk:px-12 desk:py-12 ${cookMode ? "cook-on" : ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <p className="micro">
            {COURSE_LABEL[recipe.course]} · {recipe.kitchenName} · {formatMinutes(recipe.minutes)}
          </p>
          <h2 className="mt-1 font-serif text-[32px] font-normal leading-tight desk:text-[40px]">{recipe.title}</h2>
          <p className="font-serif text-[17px] italic text-inksoft">Handed down by {recipe.handedDownBy}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={line} aria-pressed={cookMode} onClick={() => setCookMode((value) => !value)}>
            Propped-phone cook mode: {cookMode ? "On" : "Off"}
          </button>
          <button type="button" className={solid} onClick={() => void madeThis()}>
            We made this · {cooked}
          </button>
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
      {deleted ? <p className="mt-4 text-sm">This recipe is in the trash. Undo is available for 6 seconds.</p> : null}

      <div className="mt-7 grid gap-8 desk:grid-cols-[300px_1fr] desk:gap-11">
        <div>
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div>
              <div className="micro">Servings</div>
              <strong className="text-lg tabular-nums">{servings} servings</strong>
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
          <div className="mb-3 h-0.5 bg-rule">
            <div
              className="h-full bg-ink"
              style={{ width: `${recipe.ingredients.length ? Math.round((checkedCount / recipe.ingredients.length) * 100) : 0}%` }}
            />
          </div>
          <ul>
            {recipe.ingredients.map((ingredient, index) => (
              <li key={`${ingredient.original_text}-${index}`}>
                <button
                  type="button"
                  onClick={() => setChecked((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)))}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-rule py-2 text-left tabular-nums [font-variant-numeric:tabular-nums_diagonal-fractions] ${
                    checked[index] ? "text-inkmuted line-through" : ""
                  } ${cookMode ? "text-[17px]" : ""}`}
                >
                  <span>{ingredient.item}</span>
                  <span className="font-semibold">{quantities[index]}</span>
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
              <button
                key={stepText}
                type="button"
                onClick={() => setDone((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)))}
                className={`block w-full border-b border-rule py-4 pl-4 text-left ${
                  isActive ? "border-l-2 border-l-accent bg-[#fdfbf7] pr-3" : "border-l-2 border-l-transparent"
                } ${isDone ? "opacity-40" : ""}`}
              >
                <div className={`micro ${isActive ? "text-accent" : ""}`}>
                  Step {String(index + 1).padStart(2, "0")} · {isDone ? "Completed" : isActive ? "Active step" : "Waiting"}
                </div>
                <p className={cookMode ? "text-[21px] leading-relaxed" : ""}>{stepText}</p>
              </button>
            );
          })}
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 bg-ink px-5 py-3 text-[13px] text-sheet">
          <span>{toast}</span>
          <button type="button" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#f3c6b8]" onClick={() => void undo()}>
            Undo
          </button>
        </div>
      ) : null}
    </article>
  );
}

const solid =
  "inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-sheet";
const line =
  "inline-flex min-h-11 items-center justify-center border border-ink bg-transparent px-4 text-[12px] font-medium uppercase tracking-[0.08em] text-ink";
const step = "inline-flex h-11 w-11 items-center justify-center border border-ink text-lg";
