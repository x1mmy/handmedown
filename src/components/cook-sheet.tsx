"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiCamera3Line,
  RiCheckLine,
  RiDeleteBinLine,
  RiFireFill,
  RiHeart3Fill,
  RiHeart3Line,
  RiMoreFill,
  RiPencilLine,
  RiSubtractLine,
  RiTimeLine,
} from "@remixicon/react";

import { BIG } from "@/components/app/screen";
import { BackButton } from "@/components/book-controls";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Drawer, DrawerBody, DrawerHeader } from "@/components/base/drawer/drawer";
import { IconButton } from "@/components/base/buttons/icon-button";
import { toast } from "@/components/base/toast/toast";
import { CookMode } from "@/components/cook-mode";
import { RollingText } from "@/components/motion";
import { ApiError, api } from "@/lib/client-api";
import { formatQuantity, scaleServings } from "@/lib/fractions";
import { COURSE_LABEL, formatMinutes } from "@/lib/format";
import { resolveCookedUpdate, undoToastRemaining } from "@/lib/persistence-feedback";
import type { RecipeDetail } from "@/lib/types";
import { cx } from "@/utils/cx";

export function CookSheet({ recipe }: { recipe: RecipeDetail }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [servings, setServings] = useState(recipe.servings);
  const [checked, setChecked] = useState<boolean[]>(() => recipe.ingredients.map(() => false));
  const [done, setDone] = useState<boolean[]>(() => recipe.steps.map(() => false));
  const [cooking, setCooking] = useState(false);
  const [wakeFallback, setWakeFallback] = useState(false);
  const [cooked, setCooked] = useState(recipe.cookedCount);
  const [favourite, setFavourite] = useState(recipe.favourite);
  const [stamp, setStamp] = useState(0);
  const [stampDate, setStampDate] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  // Checks survive a reload for this tab only.
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

  // Keep the screen awake while cooking.
  useEffect(() => {
    if (!cooking) return;
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
  }, [cooking]);

  const quantities = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => {
        if (ingredient.numerator === 0) return "";
        const scaled = scaleServings(ingredient.numerator, ingredient.denominator, servings, recipe.servings);
        return formatQuantity(scaled.numerator, scaled.denominator, ingredient.unit);
      }),
    [recipe.ingredients, recipe.servings, servings],
  );
  const activeStep = done.findIndex((item) => !item);

  async function madeThis() {
    const storageKey = `hmd-cook:${recipe.id}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    const previous = { cooked, stamp, stampDate };
    setCooked(previous.cooked + 1);
    setStamp(previous.stamp + 1);
    setStampDate(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
    try {
      const result = await api<{ cookedCount: number; applied: boolean }>(`/api/books/${recipe.bookId}/recipes/${recipe.id}/cook`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key }),
      });
      sessionStorage.removeItem(storageKey);
      const resolved = resolveCookedUpdate(result.cookedCount, result.applied);
      setCooked(resolved.count);
      if (!resolved.stamped) {
        setStamp(previous.stamp);
        setStampDate(previous.stampDate);
      } else {
        toast.success("Logged it", { description: `${recipe.title} has been made ${resolved.count} ${resolved.count === 1 ? "time" : "times"}.` });
      }
    } catch (caught) {
      setCooked(previous.cooked);
      setStamp(previous.stamp);
      setStampDate(previous.stampDate);
      toast.error(caught instanceof ApiError ? caught.message : "Could not log that. Try again.");
    }
  }

  async function remove() {
    setMoreOpen(false);
    try {
      const result = await api<{ deletedAt: number }>(`/api/books/${recipe.bookId}/recipes/${recipe.id}`, { method: "DELETE" });
      const id = toast(`Deleted “${recipe.title}”`, {
        duration: Math.max(1000, undoToastRemaining(result.deletedAt, Date.now())),
        actions: [
          {
            label: "Undo",
            variant: "secondary",
            onClick: () => {
              toast.dismiss(id);
              void api(`/api/books/${recipe.bookId}/recipes/${recipe.id}/undo`, { method: "POST" })
                .then(() => router.push(`/recipes/${recipe.id}`))
                .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "The undo window has closed"));
            },
          },
        ],
      });
      router.push("/");
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not delete this recipe");
    }
  }

  async function toggleFavourite() {
    const next = !favourite;
    setFavourite(next);
    try {
      await api(`/api/books/${recipe.bookId}/recipes/${recipe.id}/favourite`, { method: "POST", body: JSON.stringify({ on: next }) });
      router.refresh();
    } catch (caught) {
      setFavourite(!next);
      toast.error(caught instanceof ApiError ? caught.message : "Could not update favourites");
    }
  }

  const roundOnImage =
    "flex size-10 items-center justify-center rounded-full bg-background-primary-default/85 text-foreground-icon-primary shadow-sm outline-none backdrop-blur-md transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-border-focus-ring";

  return (
    <div className="pb-24 lg:pb-0">
      <div className="relative lg:mx-auto lg:max-w-6xl lg:px-10 lg:pt-8 xl:max-w-7xl">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-background-tertiary-default lg:aspect-[21/9] lg:max-h-[520px] lg:rounded-3xl">
          {recipe.heroUrl ? (
            <img src={recipe.heroUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-4 bg-accent-50 p-10">
              <p className="max-w-md text-center font-hand text-title-1-medium text-accent-700">{recipe.marginNote || recipe.title}</p>
              {recipe.canEdit ? (
                <ButtonLink href={`/recipes/${recipe.id}/edit#photo`} variant="secondary" leadingIcon={RiCamera3Line} className="rounded-full px-4">
                  Add a photo
                </ButtonLink>
              ) : null}
            </div>
          )}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+12px)]">
            <BackButton onImage />
            <div className="flex gap-2">
              <button type="button" className={roundOnImage} aria-pressed={favourite} aria-label={favourite ? "Remove from favourites" : "Add to favourites"} onClick={() => void toggleFavourite()}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={favourite ? "on" : "off"}
                    initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {favourite ? <RiHeart3Fill className="size-5 text-accent-500" aria-hidden /> : <RiHeart3Line className="size-5" aria-hidden />}
                  </motion.span>
                </AnimatePresence>
              </button>
              {recipe.canEdit ? (
                <button type="button" className={roundOnImage} aria-label="More" onClick={() => setMoreOpen(true)}>
                  <RiMoreFill className="size-5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <article className="relative -mt-6 rounded-t-3xl bg-background-primary-default px-4 pt-6 lg:mx-auto lg:mt-0 lg:max-w-6xl lg:rounded-none lg:bg-transparent lg:px-10 lg:pt-10 xl:max-w-7xl">
        <AnimatePresence>
          {stamp > 0 ? (
            <motion.p
              key={stamp}
              role="status"
              className="pointer-events-none absolute end-4 top-6 z-10 rounded-xl border-2 border-accent-500 px-3 py-1.5 text-center text-caption-1-bold uppercase text-accent-600 lg:end-8 lg:top-8"
              initial={reduce ? false : { scale: 1.3, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: -8, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 18 }}
            >
              Made
              <span className="block text-caption-1-medium normal-case">{stampDate}</span>
            </motion.p>
          ) : null}
        </AnimatePresence>

        <p className="text-body-medium text-accent-600">
          {COURSE_LABEL[recipe.course]}, {recipe.kitchenName}
        </p>
        <h1 className="mt-1 max-w-3xl pe-20 text-display-4-bold text-text-primary lg:text-display-2-bold">{recipe.title}</h1>
        <p className="mt-2 text-headline-regular text-text-secondary">
          Handed down by <span className="text-text-primary">{recipe.handedDownBy}</span>
          {recipe.recipeBy && recipe.recipeBy !== recipe.handedDownBy ? <>, from {recipe.recipeBy}&apos;s kitchen</> : null}
        </p>

        <dl className="mt-5 grid max-w-md grid-cols-3 divide-x divide-separator-border rounded-2xl bg-background-secondary-default py-3 rtl:divide-x-reverse">
          <Stat label="Time" value={formatMinutes(recipe.minutes)} />
          <Stat label="Serves" value={<RollingText value={String(servings)} />} />
          <Stat label="Made" value={<><RollingText value={String(cooked)} />×</>} />
        </dl>

        {recipe.marginNote ? (
          <p className="mt-5 max-w-xl rounded-2xl bg-accent-50 px-4 py-3 font-hand text-title-2-medium text-accent-800">&ldquo;{recipe.marginNote}&rdquo;</p>
        ) : null}

        <div className="mt-6 hidden gap-3 lg:flex">
          <Button leadingIcon={RiFireFill} className={BIG} onClick={() => setCooking(true)}>
            Start cooking
          </Button>
          <Button variant="secondary" leadingIcon={RiCheckLine} className={BIG} onClick={() => void madeThis()}>
            Made it
          </Button>
        </div>

        <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(340px,420px)_1fr] lg:gap-14">
          <section aria-labelledby="ingredients" className="self-start lg:sticky lg:top-24 lg:rounded-3xl lg:bg-background-primary-default lg:p-6 lg:shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 id="ingredients" className="text-title-2-semibold text-text-primary">
                Ingredients
              </h2>
              <div className="flex items-center gap-1 rounded-full bg-background-secondary-default p-1">
                <IconButton
                  icon={RiSubtractLine}
                  size="small"
                  aria-label="Fewer servings"
                  disabled={servings <= 1}
                  onClick={() => setServings((value) => Math.max(1, value - 1))}
                  className="rounded-full"
                />
                <span className="min-w-20 text-center text-body-medium text-text-primary" aria-live="polite">
                  <RollingText value={String(servings)} /> {servings === 1 ? "serving" : "servings"}
                </span>
                <IconButton
                  icon={RiAddLine}
                  size="small"
                  aria-label="More servings"
                  disabled={servings >= 24}
                  onClick={() => setServings((value) => Math.min(24, value + 1))}
                  className="rounded-full"
                />
              </div>
            </div>
            <ul className="mt-2">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient.original_text}-${index}`} className="border-b border-separator-border last:border-b-0">
                  <Checkbox
                    isSelected={Boolean(checked[index])}
                    onChange={(value) => setChecked((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))}
                    className="flex w-full gap-3 py-3.5 [&>span:last-child]:flex-1"
                  >
                    <span className={cx("flex items-baseline justify-between gap-3 text-headline-regular", checked[index] && "text-text-tertiary line-through")}>
                      <span>{ingredient.item || ingredient.original_text}</span>
                      {quantities[index] ? <span className="shrink-0 text-headline-semibold [font-variant-numeric:diagonal-fractions]">{quantities[index]}</span> : null}
                    </span>
                  </Checkbox>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="method">
            <h2 id="method" className="text-title-2-semibold text-text-primary">
              Method
            </h2>
            <ol className="mt-3 grid gap-2">
              {recipe.steps.map((stepText, index) => {
                const isDone = done[index];
                const isActive = index === activeStep;
                return (
                  <li key={`${index}-${stepText.slice(0, 24)}`}>
                    <button
                      type="button"
                      aria-pressed={Boolean(isDone)}
                      onClick={() => setDone((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)))}
                      className={cx(
                        "flex w-full gap-4 rounded-2xl p-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                        isActive ? "bg-accent-50" : "hover:bg-background-secondary-default",
                        isDone && "opacity-50",
                      )}
                    >
                      <span
                        className={cx(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-headline-semibold",
                          isDone ? "bg-accent-500 text-text-white" : isActive ? "bg-background-primary-default text-accent-600 shadow-card" : "bg-background-secondary-default text-text-secondary",
                        )}
                      >
                        {isDone ? <RiCheckLine className="size-4" aria-hidden /> : index + 1}
                      </span>
                      <span className="pt-1 text-headline-regular text-text-primary lg:text-title-3-regular">{stepText}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </article>

      {/* Phones: the two things you do on this screen, in thumb reach. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-separator-border bg-background-primary-default/90 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-xl lg:hidden">
        <Button variant="secondary" leadingIcon={RiCheckLine} className={cx(BIG, "flex-1")} onClick={() => void madeThis()}>
          Made it
        </Button>
        <Button leadingIcon={RiFireFill} className={cx(BIG, "flex-[1.5]")} onClick={() => setCooking(true)}>
          Start cooking
        </Button>
      </div>

      <CookMode
        open={cooking}
        title={recipe.title}
        steps={recipe.steps}
        ingredients={recipe.ingredients.map((ingredient, index) => ({ label: ingredient.item || ingredient.original_text, quantity: quantities[index] ?? "" }))}
        servings={servings}
        checked={checked}
        onToggleIngredient={(index, value) => setChecked((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))}
        done={done}
        onStepDone={(index) => setDone((current) => current.map((item, itemIndex) => (itemIndex === index ? true : item)))}
        wakeFallback={wakeFallback}
        onClose={() => setCooking(false)}
        onFinish={() => {
          setCooking(false);
          void madeThis();
        }}
      />

      <Drawer placement="bottom" isOpen={moreOpen} onOpenChange={setMoreOpen} className="rounded-3xl">
        <DrawerHeader title={recipe.title} />
        <DrawerBody>
          <div className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="flex h-14 items-center gap-3 rounded-2xl bg-background-secondary-default px-4 text-headline-medium text-text-primary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiPencilLine className="size-5 text-foreground-icon-secondary" aria-hidden />
              Edit recipe
            </Link>
            <button
              type="button"
              onClick={() => void remove()}
              className="flex h-14 items-center gap-3 rounded-2xl bg-background-secondary-default px-4 text-start text-headline-medium text-text-destructive outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiDeleteBinLine className="size-5" aria-hidden />
              Delete recipe
            </button>
          </div>
        </DrawerBody>
      </Drawer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-3 text-center">
      <dt className="flex items-center justify-center gap-1 text-caption-1-medium text-text-secondary">
        {label === "Time" ? <RiTimeLine className="size-3.5" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="mt-0.5 text-headline-semibold text-text-primary">{value}</dd>
    </div>
  );
}
