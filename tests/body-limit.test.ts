import { describe, expect, it } from "vitest";

import { assertBodyLimit } from "@/lib/body-limit";

const req = (method: string, length?: string) =>
  new Request("http://x/api", { method, headers: length === undefined ? {} : { "content-length": length } });

describe("body limit", () => {
  it("lets a bodyless DELETE through, as browsers send no Content-Length", () => {
    expect(() => assertBodyLimit(req("DELETE"), 10)).not.toThrow();
  });

  it("still demands a size on writes that carry a body", () => {
    expect(() => assertBodyLimit(req("POST"), 10)).toThrow(/Content-Length/);
    expect(() => assertBodyLimit(req("PATCH", "0"), 10)).not.toThrow();
    expect(() => assertBodyLimit(req("POST", "11"), 10)).toThrow(/too large/);
    expect(() => assertBodyLimit(req("POST", "-1"), 10)).toThrow(/too large/);
  });
});
