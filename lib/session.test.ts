import { describe, it, expect } from "vitest";
import { ownsAttempt, ownsPayment, ANON_CUSTOMER } from "@/lib/session";

const attemptA = { customerId: "cust_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
const CUST_A = "cust_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CUST_B = "cust_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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

describe("receipt payment-record ownership (ownsPayment)", () => {
  it("lets the creating session view/settle its retrieved payment", () => {
    expect(ownsPayment({ customer_id: CUST_A }, CUST_A)).toBe(true);
  });

  it("blocks a different session from a foreign payment_id (the IDOR fix)", () => {
    expect(ownsPayment({ customer_id: CUST_A }, CUST_B)).toBe(false);
  });

  it("blocks an anonymous / cookieless session", () => {
    expect(ownsPayment({ customer_id: CUST_A }, ANON_CUSTOMER)).toBe(false);
    expect(ownsPayment({ customer_id: CUST_A }, "")).toBe(false);
  });

  it("treats a payment with no customer_id (or a non-string) as unowned", () => {
    expect(ownsPayment({}, CUST_A)).toBe(false);
    expect(ownsPayment({ customer_id: null }, CUST_A)).toBe(false);
    expect(ownsPayment({ customer_id: 12345 as unknown }, CUST_A)).toBe(false);
    expect(ownsPayment(null, CUST_A)).toBe(false);
    expect(ownsPayment(undefined, CUST_A)).toBe(false);
  });

  it("blocks a tampered/forged id that does not exactly match", () => {
    expect(ownsPayment({ customer_id: CUST_A }, CUST_A.slice(0, -1))).toBe(false); // one char short
    expect(ownsPayment({ customer_id: CUST_A }, CUST_A.toUpperCase())).toBe(false); // wrong case
  });
});
