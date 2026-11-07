import Link from "next/link";
import type { ReactNode } from "react";
import { RiArrowRightSLine } from "@remixicon/react";

import { cx } from "@/utils/cx";

/** Screen column: phone width first, a wider reading column on desktop. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-2xl lg:max-w-5xl lg:px-8", className)}>{children}</main>;
}

/** iOS-style large title. */
export function ScreenHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+24px)] lg:px-0 lg:pt-10">
      <div className="min-w-0 flex-1">
        {eyebrow ? <div className="text-body-medium text-text-secondary">{eyebrow}</div> : null}
        <h1 className="truncate text-display-4-bold text-text-primary">{title}</h1>
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mt-8", className)}>
      {title ? (
        <div className="mb-3 flex items-baseline justify-between gap-3 px-4 lg:px-0">
          <h2 className="text-title-2-semibold text-text-primary">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** White inset card that holds list rows, like an iOS grouped table. */
export function Grouped({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cx("mx-4 overflow-hidden rounded-3xl bg-background-primary-default shadow-card lg:mx-0", className)}>{children}</ul>
  );
}

/** One list row. Divider starts after the leading thumbnail, as on iOS. */
export function Row({
  href,
  leading,
  title,
  subtitle,
  trailing,
  chevron = Boolean(href),
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  const body = (
    <>
      {leading ? <span className="shrink-0 py-2.5">{leading}</span> : null}
      <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 border-b border-separator-border py-2.5 pe-4 group-last/row:border-b-0">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-headline-medium text-text-primary">{title}</span>
          {subtitle ? <span className="mt-0.5 block truncate text-body-regular text-text-secondary">{subtitle}</span> : null}
        </span>
        {trailing}
        {chevron ? <RiArrowRightSLine className="size-5 shrink-0 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden /> : null}
      </span>
    </>
  );
  return (
    <li className="group/row">
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-3 ps-4 outline-none transition-colors hover:bg-background-primary-hover focus-visible:bg-background-primary-hover active:bg-background-primary-active"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 ps-4">{body}</div>
      )}
    </li>
  );
}

/** Square photo or a handwritten stand-in when a recipe has no photo. */
export function Thumb({ src, note, className }: { src: string | null; note?: string; className?: string }) {
  if (src) return <img src={src} alt="" loading="lazy" className={cx("size-12 rounded-xl object-cover", className)} />;
  return (
    <span
      aria-hidden
      className={cx(
        "flex size-12 items-center justify-center overflow-hidden rounded-xl bg-accent-50 p-1 text-center text-body-2-medium font-hand text-accent-700",
        className,
      )}
    >
      {note ? note.split(" ").slice(0, 3).join(" ") : ""}
    </span>
  );
}

/** Big tap targets for phone thumbs, layered onto BoardUI buttons. */
export const BIG = "h-12 rounded-2xl px-5 text-headline-semibold";
