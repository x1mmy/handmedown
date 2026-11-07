import { FOOTER_TEXT, STASH_LABS_URL } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 desk:px-6">
      <div className="mx-auto max-w-page border-t border-rule pt-4">
        <a
          href={STASH_LABS_URL}
          className="inline-flex min-h-11 items-center text-[11px] tracking-[0.14em] text-inkmuted [font-variant-caps:all-small-caps]"
        >
          {FOOTER_TEXT}
        </a>
      </div>
    </footer>
  );
}
