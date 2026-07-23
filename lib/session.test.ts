import { describe, it, expect } from "vitest";
import { ownsAttempt, ANON_CUSTOMER } from "@/lib/session";

const attemptA = { customerId: "cust_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };

describe("session ownership (ownsAttempt)", () => {
  it("lets the creating session own its payment", () => {
    expect(ownsAttempt(attemptA, attemptA.customerId)).toBe(true);
  });

  it("blocks a different session (cross-session access)", () => {
    expect(ownsAttempt(attemptA, "cust_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")).toBe(false);
  });

  it("blocks an anonymous / cookieless session", () => {
    expect(ownsAttempt(attemptA, ANON_CUSTOMER)).toBe(false);
    expect(ownsAttempt(attemptA, "")).toBe(false);
  });

  it("blocks a tampered/forged id that does not exactly match", () => {
    // a truncated or altered cookie value yields a different customer id -> no access
    expect(ownsAttempt(attemptA, "cust_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false); // one char short
    expect(ownsAttempt(attemptA, "cust_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(false); // wrong case
  });

  it("owns nothing when the payment does not exist", () => {
    expect(ownsAttempt(undefined, attemptA.customerId)).toBe(false);
  });
});
