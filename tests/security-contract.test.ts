import { describe, expect, it } from "vitest";

import { contentDispositionAttachment } from "@/lib/content-disposition";
import { assertSupabaseConfigured } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { renderPrintHtml } from "@/lib/print/render-html";
import { paginate } from "@/lib/print/paginate";
import { assertCanonicalExportPath, assertCanonicalMediaPath } from "@/lib/storage-path";
import type { ExportSnapshot } from "@/lib/types";

const BOOK = "10000000-0000-4000-8000-000000000001";
const MEDIA = "10000000-0000-4000-8000-000000000201";
const JOB = "10000000-0000-4000-8000-000000000301";

describe("storage paths", () => {
  it("rejects forged photo and pdf paths", () => {
    expect(assertCanonicalMediaPath(`book/${BOOK}/${MEDIA}.jpg`, BOOK, MEDIA)).toContain(MEDIA);
    for (const path of [
      `book/${BOOK}/../${MEDIA}.jpg`,
      `book/other/${MEDIA}.jpg`,
      `/${BOOK}/${MEDIA}.jpg`,
      `book/${BOOK}/${MEDIA}.jpg/../../secret`,
      `book\\${BOOK}\\${MEDIA}.jpg`,
    ]) {
      expect(() => assertCanonicalMediaPath(path, BOOK, MEDIA)).toThrow(AppError);
    }
    expect(assertCanonicalExportPath(`exports/${JOB}.pdf`, JOB)).toBe(`exports/${JOB}.pdf`);
    for (const path of [`exports/../${JOB}.pdf`, `exports/${BOOK}.pdf`, `book/${JOB}.pdf`, `exports/${JOB}.pdf/extra`]) {
      expect(() => assertCanonicalExportPath(path, JOB)).toThrow(AppError);
    }
  });
});

describe("supabase configuration", () => {
  it("fails closed when any key is missing", () => {
    const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
    const saved = names.map((name) => process.env[name]);
    for (const name of names) process.env[name] = "set";
    expect(assertSupabaseConfigured().secretKey).toBe("set");
    for (const missing of names) {
      for (const name of names) process.env[name] = "set";
      delete process.env[missing];
      expect(() => assertSupabaseConfigured()).toThrow(AppError);
    }
    names.forEach((name, index) => {
      if (saved[index] === undefined) delete process.env[name];
      else process.env[name] = saved[index];
    });
  });
});

describe("download names", () => {
  it("keeps an ascii filename and a utf-8 filename*", () => {
    const header = contentDispositionAttachment("Nani’s Kitchen 🍲\n");
    expect(header).toContain('filename="Nanis Kitchen "');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).not.toMatch(/[\u0000-\u001f]/);
    expect(header).toContain("%F0%9F%8D%B2");
  });
});

describe("print snapshot", () => {
  it("does not embed data-uri photos", () => {
    const snapshot: ExportSnapshot = {
      version: 1,
      bookId: BOOK,
      title: "The Fam",
      subtitle: "Family edition",
      clothId: "olive",
      bleed: false,
      capturedAt: "2026-11-07T00:00:00.000Z",
      recipes: [
        {
          id: "10000000-0000-4000-8000-000000000101",
          title: "Salmon",
          course: "Mains",
          kitchenName: "Nan's Kitchen",
          handedDownBy: "Nan",
          recipeBy: "Nani",
          minutes: 30,
          servings: 4,
          marginNote: "",
          ingredients: ["1 cup couscous"],
          steps: ["Bake."],
        },
      ],
      albums: [
        {
          name: "Table",
          photos: [{ src: "/api/media/" + MEDIA, caption: "Supper", meta: "Nan's Kitchen" }],
        },
      ],
    };
    const html = renderPrintHtml(snapshot);
    expect(html).not.toContain("data:image");
    expect(paginate(snapshot).some((page) => page.kind === "cover" && page.title === "The Fam")).toBe(true);
    expect(html).toContain("From Nani");
  });
});
