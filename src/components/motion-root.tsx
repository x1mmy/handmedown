"use client";

import { MotionConfig } from "motion/react";

import { EASE } from "@/components/motion";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}
