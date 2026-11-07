import { AlbumBrowser } from "@/components/album-browser";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { repo, principal, book } = await loadBook(bookId);
  const albums = await repo.listAlbums(principal, bookId);
  const kitchens = book.kitchens.filter((kitchen) => book.myKitchenIds.includes(kitchen.id));
  return (
    <main className="mx-auto w-full max-w-page px-4 py-6 desk:px-6">
      <p className="micro">Named albums</p>
      <h2 className="mb-4 font-serif text-3xl font-normal">Family photographs</h2>
      <AlbumBrowser bookId={bookId} albums={albums} kitchens={kitchens} />
    </main>
  );
}
