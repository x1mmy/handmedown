import { Screen, ScreenHeader } from "@/components/app/screen";
import { ButtonLink } from "@/components/base/buttons/button";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Screen className="flex-1">
        <ScreenHeader title="This page is not in the book" />
        <div className="px-4 lg:px-0">
          <p className="mt-2 text-headline-regular text-text-secondary">The recipe may have been deleted, or the link is wrong.</p>
          <ButtonLink href="/" className="mt-6 h-11 rounded-full px-5 text-headline-semibold">
            Back to recipes
          </ButtonLink>
        </div>
      </Screen>
      <SiteFooter />
    </div>
  );
}
