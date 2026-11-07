"use client";

import { Screen, ScreenHeader } from "@/components/app/screen";
import { Button } from "@/components/base/buttons/button";
import { SiteFooter } from "@/components/site-footer";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Screen className="flex-1">
        <ScreenHeader title="Something went wrong" />
        <div className="px-4 lg:px-0">
          <p className="mt-2 text-headline-regular text-text-secondary">{error.message || "Please try again."}</p>
          <Button onClick={() => reset()} className="mt-6 h-11 rounded-full px-5 text-headline-semibold">
            Try again
          </Button>
        </div>
      </Screen>
      <SiteFooter />
    </div>
  );
}
