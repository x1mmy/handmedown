import { Screen } from "@/components/app/screen";
import { Skeleton } from "@/components/base/skeleton/skeleton";

export default function LoadingBook() {
  return (
    <Screen>
      <div aria-busy="true" className="px-4 pt-[calc(env(safe-area-inset-top)+24px)] lg:px-0 lg:pt-10">
        <span className="sr-only" role="status">
          Loading
        </span>
        <Skeleton shape="text" className="h-4 w-28" />
        <Skeleton shape="text" className="mt-2 h-9 w-48" />
        <Skeleton className="mt-5 h-11 w-full rounded-full lg:max-w-md" />
      </div>
      <div className="mt-8 flex gap-3 overflow-hidden px-4 lg:px-0">
        <Skeleton className="aspect-[4/5] w-[72%] max-w-72 shrink-0 rounded-3xl" />
        <Skeleton className="aspect-[4/5] w-[72%] max-w-72 shrink-0 rounded-3xl" />
      </div>
      <div className="mx-4 mt-8 rounded-3xl bg-background-primary-default p-4 shadow-card lg:mx-0">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="flex items-center gap-3 py-2.5">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex-1">
              <Skeleton shape="text" className="h-4 w-2/3" />
              <Skeleton shape="text" className="mt-2 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
