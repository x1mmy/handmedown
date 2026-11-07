import type { Course } from "@/lib/types";

export const COURSE_LABEL: Record<Course, string> = {
  mains: "Mains",
  sweets: "Sweets",
  bakes: "Bakes",
  sides: "Sides",
};

export function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hr`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
  return `${minutes} min`;
}

export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
