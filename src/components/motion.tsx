"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function tween(seconds = 0.24) {
  return { duration: seconds, ease: EASE };
}

export function PageTurn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const seen = useRef(false);

  useEffect(() => {
    seen.current = true;
  }, []);

  const enter = !reduce && seen.current;

  return (
    <motion.div
      key={pathname}
      initial={enter ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={tween(0.26)}
    >
      {children}
    </motion.div>
  );
}

/** Book routes animate inside the masthead. Other routes animate here. */
export function MotionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inBook = /^\/books\/(?!new(?:\/|$))[^/]+/.test(pathname);
  if (inBook) return children;
  return <PageTurn>{children}</PageTurn>;
}

export function FoldedCorner({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 z-10 h-[22px] w-[22px] origin-top-right border-b border-l border-rule bg-[#efece4]"
          style={{ clipPath: "polygon(0 0, 100% 100%, 100% 0)" }}
          initial={reduce ? false : { rotate: -32, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotate: -22, opacity: 0 }}
          transition={tween(0.28)}
        />
      ) : null}
    </AnimatePresence>
  );
}

export function RollingText({ value, className = "" }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`relative inline-block overflow-hidden align-bottom tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      <span className="invisible whitespace-nowrap" aria-hidden>
        {value}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          aria-hidden
          className="absolute inset-0 whitespace-nowrap"
          initial={reduce ? false : { y: "70%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={reduce ? { opacity: 1 } : { y: "-70%", opacity: 0 }}
          transition={reduce ? { duration: 0 } : tween(0.22)}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function InkTick({ checked }: { checked: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <motion.path
        d="M3.5 9.2 L7.2 13 L14.5 4.5"
        fill="none"
        stroke="#171614"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : tween(0.26)}
      />
    </svg>
  );
}
