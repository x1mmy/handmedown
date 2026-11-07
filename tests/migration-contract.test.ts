import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FOOTER_TEXT, STASH_LABS_URL } from "@/lib/constants";

const sql = readFileSync("supabase/migrations/20261107160000_hand_me_down.sql", "utf8");

const tables = [
  "books",
  "book_members",
  "kitchens",
  "kitchen_members",
  "kitchen_join_requests",
  "recipes",
  "recipe_favourites",
  "albums",
  "media_assets",
  "album_photos",
  "book_invites",
  "cooking_events",
  "export_jobs",
];

describe("migration contract", () => {
  it("enables and forces RLS, with check policies, on every table", () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toMatch(new RegExp(`create policy ${table}_update[\\s\\S]+?using \\([\\s\\S]+?with check \\(`, "i"));
    }
  });

  it("keeps security definer functions in the private schema", () => {
    const publicFns = sql.split("create or replace function public.");
    publicFns.slice(1).forEach((body) => {
      const head = body.slice(0, 240);
      expect(head).toContain("security invoker");
      expect(head).not.toContain("security definer");
    });
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("token_hash");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)");
    expect(sql).not.toMatch(/references public\.kitchens \(book_id, id\) on delete cascade/i);
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
