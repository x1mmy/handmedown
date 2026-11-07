import { FOOTER_TEXT, STASH_LABS_URL } from "@/lib/constants";

/**
 * "Built by Stash Labs." in the Stash Labs brand: the folded S mark, the
 * stash/labs wordmark and its orange full stop. Hover mirrors stashlabs.com.au:
 * the fold flips, the stop hops, the label underline draws in.
 */
export function SiteFooter() {
  return (
    <footer className="no-print mx-auto mt-16 w-full max-w-2xl px-4 pb-8 lg:max-w-6xl lg:px-10 xl:max-w-7xl">
      <div className="border-t border-separator-border pt-4">
        <a href={STASH_LABS_URL} target="_blank" rel="noopener" aria-label={FOOTER_TEXT} className="stash-credit">
          <span className="stash-credit__by" aria-hidden>
            Built by
          </span>
          <svg className="stash-credit__mark" viewBox="0 0 100 100" aria-hidden>
            <polygon className="stash-credit__fold" points="24,32 76,52 76,70 24,50" />
            <polygon points="88,8 24,32 24,50 88,26" fill="currentColor" />
            <polygon points="76,52 12,76 12,94 76,70" fill="currentColor" />
          </svg>
          <span className="stash-credit__word" aria-hidden>
            <span className="stash-credit__stash">stash</span> labs
            <svg className="stash-credit__stop" viewBox="0 0 13 14" aria-hidden>
              <polygon points="0,0 13,5 13,14 0,9" />
            </svg>
          </span>
        </a>
      </div>
    </footer>
  );
}
