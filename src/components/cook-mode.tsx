"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine, RiCloseLine, RiListCheck2 } from "@remixicon/react";

import { BIG } from "@/components/app/screen";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Drawer, DrawerBody, DrawerHeader } from "@/components/base/drawer/drawer";
import { cx } from "@/utils/cx";

const SHEET_EASE = [0.32, 0.72, 0, 1] as const;

/** One step at a time, big enough to read from the bench. Swipe or tap Next. */
export function CookMode({
  open,
  title,
  steps,
  ingredients,
  servings,
  checked,
  onToggleIngredient,
  done,
  onStepDone,
  wakeFallback,
  onClose,
  onFinish,
}: {
  open: boolean;
  title: string;
  steps: string[];
  ingredients: { label: string; quantity: string }[];
  servings: number;
  checked: boolean[];
  onToggleIngredient: (index: number, value: boolean) => void;
  done: boolean[];
  onStepDone: (index: number) => void;
  wakeFallback: boolean;
  onClose: () => void;
  onFinish: () => void;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [listOpen, setListOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const last = steps.length - 1;

  // Open on the first step not yet done.
  useEffect(() => {
    if (!open) return;
    const next = done.findIndex((item) => !item);
    setIndex(next < 0 ? 0 : next);
    dialog.current?.focus();
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
    // done is read once per open on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function go(to: number) {
    if (to < 0 || to > last) return;
    setDirection(to > index ? 1 : -1);
    setIndex(to);
  }

  function next() {
    onStepDone(index);
    if (index === last) onFinish();
    else go(index + 1);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={`Cooking ${title}`}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col bg-background-primary-default outline-none"
          initial={reduce ? { opacity: 0 } : { y: "100%" }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: "100%" }}
          transition={{ duration: 0.4, ease: SHEET_EASE }}
          onKeyDown={(event) => {
            if (listOpen) return;
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowRight") go(index + 1);
            if (event.key === "ArrowLeft") go(index - 1);
          }}
        >
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
            <button
              type="button"
              aria-label="Stop cooking"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-primary outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiCloseLine className="size-5" aria-hidden />
            </button>
            <p className="truncate text-headline-semibold text-text-primary" aria-live="polite">
              Step {index + 1} of {steps.length}
            </p>
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-background-secondary-default px-3.5 text-body-medium text-text-primary outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiListCheck2 className="size-4" aria-hidden />
              Ingredients
            </button>
          </div>

          <div className="mx-auto mt-4 flex w-full max-w-2xl gap-1 px-4" aria-hidden>
            {steps.map((_, stepIndex) => (
              <span
                key={stepIndex}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  stepIndex <= index ? "bg-accent-500" : "bg-background-tertiary-default",
                )}
              />
            ))}
          </div>

          <div className="relative mx-auto flex w-full max-w-2xl flex-1 items-center overflow-hidden px-6">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.div
                key={index}
                custom={direction}
                className="w-full touch-pan-y py-8"
                initial={reduce ? { opacity: 0 } : { x: direction * 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { x: direction * -80, opacity: 0 }}
                transition={{ duration: 0.32, ease: SHEET_EASE }}
                drag={reduce ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(index + 1);
                  else if (info.offset.x > 60) go(index - 1);
                }}
              >
                <p className="text-body-medium text-accent-600">{index === last ? "Last step" : `Step ${index + 1}`}</p>
                <p className="mt-3 text-title-1-medium text-text-primary lg:text-display-4-medium">{steps[index]}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {wakeFallback ? (
            <p className="mx-auto w-full max-w-2xl px-6 pb-2 text-body-regular text-text-secondary">
              This browser won&apos;t keep the screen on. Turn off auto-lock while you cook.
            </p>
          ) : null}

          <div className="mx-auto flex w-full max-w-2xl gap-3 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <Button
              variant="secondary"
              iconOnly
              leadingIcon={RiArrowLeftLine}
              aria-label="Previous step"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="size-12 rounded-2xl"
            />
            <Button trailingIcon={index === last ? RiCheckLine : RiArrowRightLine} onClick={next} className={cx(BIG, "flex-1")}>
              {index === last ? "Finish and log it" : "Next step"}
            </Button>
          </div>

          <Drawer placement="bottom" isOpen={listOpen} onOpenChange={setListOpen}>
            <DrawerHeader title="Ingredients" description={`For ${servings} ${servings === 1 ? "serving" : "servings"}`} />
            <DrawerBody>
              <ul className="pb-[env(safe-area-inset-bottom)]">
                {ingredients.map((item, itemIndex) => (
                  <li key={`${item.label}-${itemIndex}`} className="border-b border-separator-border last:border-b-0">
                    <Checkbox
                      isSelected={Boolean(checked[itemIndex])}
                      onChange={(value) => onToggleIngredient(itemIndex, value)}
                      className="flex w-full gap-3 py-3.5 [&>span:last-child]:flex-1"
                    >
                      <span className={cx("flex items-baseline justify-between gap-3 text-headline-regular", checked[itemIndex] && "text-text-tertiary line-through")}>
                        <span>{item.label}</span>
                        {item.quantity ? <span className="shrink-0 text-headline-semibold">{item.quantity}</span> : null}
                      </span>
                    </Checkbox>
                  </li>
                ))}
              </ul>
            </DrawerBody>
          </Drawer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
