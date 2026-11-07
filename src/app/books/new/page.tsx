import { redirect } from "next/navigation";

import { sharedBookId } from "@/lib/book-scope";

export const dynamic = "force-dynamic";

export default function NewBookPage() {
  redirect(`/books/${sharedBookId()}`);
}
