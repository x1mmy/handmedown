"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabase } from "@/lib/supabase/browser";

export function DemoSignIn({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(body.message ?? "Could not sign in");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6">
      <label className="micro" htmlFor="email">
        Email
      </label>
      <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border-b border-ink bg-transparent py-2" />
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <button type="submit" className="mt-5 inline-flex min-h-11 items-center border border-ink bg-ink px-5 text-[12px] uppercase tracking-[0.08em] text-sheet">
        Continue
      </button>
    </form>
  );
}

export function MagicLinkForm({
  url,
  publishableKey,
  nextPath,
}: {
  url: string;
  publishableKey: string;
  nextPath: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const supabase = createBrowserSupabase(url, publishableKey);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error: signError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (signError) setError(signError.message);
    else setMessage("Check your email for the sign-in link.");
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6">
      <p className="text-inksoft">We will email you a magic link. No password.</p>
      <label className="micro mt-4 block" htmlFor="magic-email">
        Email
      </label>
      <input id="magic-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border-b border-ink bg-transparent py-2" />
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      <button type="submit" className="mt-5 inline-flex min-h-11 items-center border border-ink bg-ink px-5 text-[12px] uppercase tracking-[0.08em] text-sheet">
        Email me a link
      </button>
    </form>
  );
}
