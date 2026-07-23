import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Per-browser identity, so each visitor's payments, subscriptions, and credentials are
 * isolated from everyone else's on the shared public demo.
 *
 * The identity is an opaque 192-bit random value in an httpOnly + secure cookie. It is
 * the ownership token itself: another session cannot guess it, JavaScript cannot read it
 * (httpOnly), and it is only sent over HTTPS in production (secure). No shared signing
 * secret is involved, so there is no weak dev-secret fallback to leak in production.
 *
 * Payment ids are seeded with this id, so two browsers buying the same plan get DISTINCT
 * payment ids — the cross-session refund hole that a shared customer id would leave open.
 */
const COOKIE = "mn_sid";
export const ANON_CUSTOMER = "cust_anon"; // a session with no cookie owns nothing

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Read-only: the current session's customer id, or ANON if none yet. Safe in RSC. */
export async function getSessionCustomerId(): Promise<string> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && v.length >= 32 ? `cust_${v}` : ANON_CUSTOMER;
}

/** Route handlers only: read or mint the session id, setting a hardened cookie. */
export async function ensureSessionCustomerId(): Promise<string> {
  const jar = await cookies();
  let v = jar.get(COOKIE)?.value;
  if (!v || v.length < 32) {
    v = crypto.randomBytes(24).toString("hex"); // 192-bit, unguessable
    jar.set(COOKIE, v, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies(),
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return `cust_${v}`;
}

/**
 * Pure ownership check (no cookies) — testable. A payment is owned only by the exact
 * session that created it; an anonymous/absent session and a mismatched (tampered or
 * cross-session) id own nothing.
 */
export function ownsAttempt(
  attempt: { customerId: string } | undefined,
  sessionCustomerId: string
): boolean {
  if (!attempt) return false;
  if (!sessionCustomerId || sessionCustomerId === ANON_CUSTOMER) return false;
  return attempt.customerId === sessionCustomerId;
}
