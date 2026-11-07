import { AlbumBrowser } from "@/components/album-browser";
import { loadBook } from "@/server/load";

export const dynamic = "force-dynamic";

export default async function AlbumPage() {
  const { repo, principal, book } = await loadBook();
  const albums = await repo.listAlbums(principal, book.id);
  const kitchens = book.kitchens.filter((kitchen) => book.myKitchenIds.includes(kitchen.id));
  return <AlbumBrowser bookId={book.id} albums={albums} kitchens={kitchens} />;
}
