import { describe, expect, it } from "vitest";

import { contentDispositionAttachment } from "@/lib/content-disposition";
import { assertSupabaseConfigured, dataAdapter } from "@/lib/config";
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

describe("adapter configuration", () => {
  it("fails closed unless demo is explicit", () => {
    const previous = process.env.HMD_DATA_ADAPTER;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secret = process.env.SUPABASE_SECRET_KEY;
    delete process.env.HMD_DATA_ADAPTER;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    expect(dataAdapter()).toBe("supabase");
    expect(() => assertSupabaseConfigured()).toThrow(/no demo fallback/);
    process.env.HMD_DATA_ADAPTER = "nope";
    expect(() => dataAdapter()).toThrow(AppError);
    process.env.HMD_DATA_ADAPTER = "demo";
    expect(dataAdapter()).toBe("demo");
    if (previous === undefined) delete process.env.HMD_DATA_ADAPTER;
    else process.env.HMD_DATA_ADAPTER = previous;
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
    if (secret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = secret;
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
