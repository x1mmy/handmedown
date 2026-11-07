import Link from "next/link";

import { solidClass } from "@/components/chrome";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="micro">Missing page</p>
      <h1 className="mt-2 font-serif text-4xl font-normal">This page is not in the book</h1>
      <p className="mt-3 text-inksoft">The book is private, or the link has wandered off.</p>
      <Link href="/" className={`${solidClass()} mt-6`}>
        Back to the table
      </Link>
    </main>
  );
}
