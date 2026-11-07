"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiBookOpenFill,
  RiBookOpenLine,
  RiHome5Fill,
  RiHome5Line,
  RiImage2Fill,
  RiImage2Line,
  RiPrinterFill,
  RiPrinterLine,
} from "@remixicon/react";

import { ButtonLink } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

const NAV = [
  { href: "/", label: "Recipes", icon: RiBookOpenLine, active: RiBookOpenFill },
  { href: "/album", label: "Album", icon: RiImage2Line, active: RiImage2Fill },
  { href: "/kitchens", label: "Kitchens", icon: RiHome5Line, active: RiHome5Fill },
  { href: "/print", label: "Print", icon: RiPrinterLine, active: RiPrinterFill },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/recipes");
  return pathname.startsWith(href);
}

/** Recipe, edit and new screens are pushed screens: no tab bar, a back button instead. */
function isPushed(pathname: string) {
  return pathname.startsWith("/recipes/");
}

export function TabBar() {
  const pathname = usePathname();
  if (isPushed(pathname)) return null;
  return (
    <nav
      aria-label="Sections"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-separator-border bg-background-primary-default/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-(--tabbar-h) max-w-md grid-cols-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = active ? item.active : item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-col items-center justify-center gap-0.5 text-caption-2-medium outline-none transition-colors active:opacity-60",
                active ? "text-accent-600" : "text-text-secondary",
              )}
            >
              <Icon className="size-6" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop: the same sections in a slim top bar. */
export function TopNav({ title }: { title: string }) {
  const pathname = usePathname();
  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 hidden h-16 border-b border-separator-border bg-background-primary-default/85 backdrop-blur-xl lg:block">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-6 px-8">
        <Link href="/" className="truncate text-headline-semibold text-text-primary">
          {title}
        </Link>
        <nav aria-label="Sections" className="flex flex-1 items-center justify-center gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-full px-4 py-2 text-body-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                  active ? "bg-accent-50 text-accent-700" : "text-text-secondary hover:bg-background-secondary-default hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ButtonLink href="/recipes/new" leadingIcon={RiAddLine} className="rounded-full px-4">
          New recipe
        </ButtonLink>
      </div>
    </header>
  );
}

/** Floating round back button for pushed screens. Goes back when there is history, home otherwise. */
export function BackButton({ fallback = "/", className, onImage = false }: { fallback?: string; className?: string; onImage?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className={cx(
        "flex size-10 items-center justify-center rounded-full outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        onImage ? "bg-background-primary-default/85 text-foreground-icon-primary shadow-sm backdrop-blur-md" : "bg-background-primary-default text-foreground-icon-primary shadow-card",
        className,
      )}
    >
      <RiArrowLeftSLine className="size-6 rtl:-scale-x-100" aria-hidden />
    </button>
  );
}

export function TitleInput({ bookId, title }: { bookId: string; title: string }) {
  return (
    <InlineName
      value={title}
      label="Book title"
      displayClass="text-display-4-bold text-text-primary"
      save={async (next) => {
        const response = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message || "Could not rename the book");
        }
      }}
    />
  );
}

/** Tap the name to rename it in place. Enter saves, Escape cancels. */
export function InlineName({
  value,
  label,
  save,
  displayClass,
}: {
  value: string;
  label: string;
  displayClass: string;
  save: (next: string) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const next = draft.trim().slice(0, 40) || "The Fam";
    setDraft(next);
    if (next === value) {
      setEditing(false);
      return;
    }
    try {
      await save(next);
      setError(null);
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  if (!editing) {
    return (
      <span className="block min-w-0">
        <button
          type="button"
          title={`Rename ${label.toLowerCase()}`}
          className={cx("block max-w-full truncate text-start outline-none focus-visible:underline", displayClass)}
          onClick={() => setEditing(true)}
        >
          {value}
        </button>
        {error ? (
          <span role="alert" className="block text-body-regular text-text-error-primary">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <input
      autoFocus
      aria-label={label}
      maxLength={40}
      value={draft}
      className={cx("w-full min-w-0 rounded-lg bg-background-primary-default px-1 outline-none ring-2 ring-border-focus-ring", displayClass)}
      onChange={(event) => setDraft(event.target.value.slice(0, 40))}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
