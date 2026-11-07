import type { Metadata } from "next";

import { TabBar, TopNav } from "@/components/book-controls";
import { PageTurn } from "@/components/motion";
import { SiteFooter } from "@/components/site-footer";
import { DEFAULT_BOOK_NAME } from "@/lib/constants";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { book } = await loadBook();
    return { title: book.title || DEFAULT_BOOK_NAME };
  } catch {
    return { title: DEFAULT_BOOK_NAME };
  }
}

export default async function BookLayout({ children }: { children: React.ReactNode }) {
  const { book } = await loadBook();
  return (
    <div className="pb-tabbar flex min-h-dvh flex-col lg:pt-16">
      <TopNav title={book.title} />
      <div className="flex-1">
        <PageTurn>{children}</PageTurn>
      </div>
      <SiteFooter />
      <TabBar />
    </div>
  );
}
