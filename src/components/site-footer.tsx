import { FOOTER_TEXT, STASH_LABS_URL } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="no-print mx-auto mt-12 w-full max-w-2xl px-4 pb-6 lg:max-w-5xl lg:px-8">
      <a
        href={STASH_LABS_URL}
        className="inline-flex min-h-11 items-center text-caption-1-medium tracking-wider text-text-secondary [font-variant-caps:all-small-caps] hover:text-text-primary"
      >
        {FOOTER_TEXT}
      </a>
    </footer>
  );
}
