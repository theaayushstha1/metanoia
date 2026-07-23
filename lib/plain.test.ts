import { describe, it, expect } from "vitest";
import { plain } from "@/lib/plain";

describe("plain() strips model Markdown from UI text", () => {
  it("removes bold markers and inline bullets, keeps content and ranges", () => {
    const out = plain(
      "**Eligible Plans Breakdown:** * **PassGate Pro**: * **Monthly Price:** $24.00 * **Budget Headroom:** $16.00 ($40.00 - $24.00)"
    );
    expect(out).not.toContain("**");
    expect(out).not.toContain("* ");
    expect(out).toContain("PassGate Pro");
    expect(out).toContain("$40.00 - $24.00"); // number range untouched
  });

  it("strips inline **label:** patterns", () => {
    expect(plain("**Uptime:** 99.9%. **Throughput:** 150 RPS.")).toBe("Uptime: 99.9%. Throughput: 150 RPS.");
  });

  it("handles headings, code, and __bold__", () => {
    expect(plain("# Title `code` __strong__ and *em*")).toBe("Title code strong and em");
  });

  it("is safe on empty / null", () => {
    expect(plain("")).toBe("");
    expect(plain(null)).toBe("");
    expect(plain(undefined)).toBe("");
  });
});
