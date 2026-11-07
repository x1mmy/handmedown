import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FOOTER_TEXT, STASH_LABS_URL } from "@/lib/constants";
import { assertOfflinePrintHtml } from "@/lib/print/pdf-worker";

const sql = readFileSync("supabase/migrations/20261107160000_hand_me_down.sql", "utf8");

const tables = [
  "books",
  "kitchens",
  "recipes",
  "recipe_favourites",
  "albums",
  "media_assets",
  "album_photos",
  "cooking_events",
  "export_jobs",
];

describe("migration contract", () => {
  it("enables and forces RLS on every table and grants only service_role", () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
    }
    expect(sql).toContain("revoke all on all tables in schema public from public, anon, authenticated");
    expect(sql).toContain("revoke all on all sequences in schema public from public, anon, authenticated");
    expect(sql).toContain("revoke all on all functions in schema public from public, anon, authenticated");
    expect(sql).toContain("grant all on all tables in schema public to service_role");
    expect(sql).toContain("grant usage on schema private to service_role");
    expect(sql).not.toContain("book_members");
    expect(sql).not.toContain("auth.uid");
    expect(sql).not.toContain("auth.role()");
    expect(sql).not.toContain("to authenticated");
  });

  it("seeds The Fam and a private media bucket without membership leftovers", () => {
    expect(sql).toContain("'10000000-0000-4000-8000-000000000001', 'The Fam'");
    expect(sql).toContain("on conflict (id) do nothing");
    expect(sql).toContain("public = false");
    expect(sql).toContain("10485760");
    expect(sql).toContain("image/jpeg");
    expect(sql).toContain("image/heic");
    expect(sql).toContain("application/pdf");
    expect(sql).toContain("foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)");
    expect(sql).not.toMatch(/references public\.kitchens \(book_id, id\) on delete cascade/i);
    expect(sql).toContain("idempotency_key");
  });
});

describe("footer credit", () => {
  it("uses the confirmed Stash Labs URL and the exact credit text", () => {
    expect(STASH_LABS_URL).toBe("https://www.stashlabs.com.au/");
    expect(FOOTER_TEXT).toBe("Built by Stash Labs");
    const footer = readFileSync("src/components/site-footer.tsx", "utf8");
    expect(footer).toContain("STASH_LABS_URL");
    expect(footer).toContain("FOOTER_TEXT");
    expect(footer).not.toContain("TODO");
  });
});

describe("print html", () => {
  it("rejects network URLs", () => {
    expect(() => assertOfflinePrintHtml("<img src='https://example.com/a.jpg'>")).toThrow(/network/);
    expect(() => assertOfflinePrintHtml("background: url(//cdn.example/a.png)")).toThrow(/network/);
    expect(() => assertOfflinePrintHtml("<h1>The Fam</h1>")).not.toThrow();
  });
});
