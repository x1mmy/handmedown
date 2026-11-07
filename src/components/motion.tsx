"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
      initial={enter ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={tween(0.24)}
    >
      {children}
    </motion.div>
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

