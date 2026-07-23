"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadHyper } from "@juspay-tech/hyper-js";
import { HyperElements } from "@juspay-tech/react-hyper-js";
import CheckoutForm from "./CheckoutForm";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY ?? "";
const KEY_READY = Boolean(PUBLISHABLE_KEY) && !PUBLISHABLE_KEY.includes("PASTE");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Client modules are still evaluated during Next.js server rendering. Guard the
// browser-only loader and cache it globally so Fast Refresh cannot add the script twice.
const browserGlobal = globalThis as typeof globalThis & {
  __metanoiaHyperPromise?: ReturnType<typeof loadHyper>;
};
const hyperPromise =
  KEY_READY && typeof window !== "undefined"
    ? (browserGlobal.__metanoiaHyperPromise ??= loadHyper(PUBLISHABLE_KEY))
    : undefined;

/**
 * Creates a payment intent server-side (which also enforces the Spending
 * Constitution) then mounts the embedded Unified Checkout when ready.
 */
export default function CheckoutClient({
  planId,
  amountLabel,
}: {
  planId: string;
  amountLabel?: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [paymentId, setPaymentId] = useState<string>();
  const [alreadyPaidId, setAlreadyPaidId] = useState<string | null>(null);
  const [error, setError] = useState<string>(
    KEY_READY ? "" : "Add your Hyperswitch publishable key to .env.local and restart the dev server."
  );

  useEffect(() => {
    if (!KEY_READY) return;
    let cancelled = false;
    fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.refused) setError(`Refused by the mandate: ${data.verdict?.summary ?? ""}`);
        else if (data.error) setError(data.error);
        else if (data.alreadyActive || data.status === "succeeded") {
          // Already actively subscribed to this plan. Don't silently jump and don't
          // double-charge — explain why and let the user choose what to do.
          setAlreadyPaidId(data.paymentId ?? "");
        } else {
          setPaymentId(data.paymentId);
          setOptions({
            clientSecret: data.clientSecret,
            appearance: { theme: "default", variables: { colorPrimary: "#2b6bf3" } },
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [planId, router]);

  if (error) {
    return (
      <div
        className="font-mono"
        style={{
          border: "1px solid var(--accent-line)",
          background: "var(--red-bg)",
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: 12.5,
          color: "var(--red)",
        }}
      >
        {error}
      </div>
    );
  }

  if (alreadyPaidId) {
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", background: "linear-gradient(180deg,#f4f8ff,#fff)" }}>
        <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", color: "var(--green)" }}>
          ALREADY SUBSCRIBED
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--ink)" }}>
          You already have an active subscription to this plan, so there is no card step and no new charge.
        </p>
        <p className="font-mono" style={{ margin: "10px 0 0", fontSize: 11, color: "var(--faint)" }}>
          Cancel it on the Subscriptions page to resubscribe — that starts a fresh payment and charges again.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/checkout/complete?payment_id=${encodeURIComponent(alreadyPaidId)}`)}
            className="font-body"
            style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--blue)", border: "none", borderRadius: 10, padding: "11px 20px", cursor: "pointer" }}
          >
            View receipt
          </button>
          <button
            onClick={() => router.push("/")}
            className="font-body"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--blue)", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "11px 20px", cursor: "pointer" }}
          >
            Back to workbench
          </button>
        </div>
      </div>
    );
  }

  if (!hyperPromise || !("clientSecret" in options)) {
    return (
      <div className="font-mono" style={{ fontSize: 12.5, color: "var(--faint)", animation: "pulse 1.6s ease-in-out infinite" }}>
        Preparing secure checkout…
      </div>
    );
  }

  return (
    <HyperElements options={options} hyper={hyperPromise}>
      <CheckoutForm
        returnUrl={`${APP_URL}/checkout/complete?payment_id=${encodeURIComponent(paymentId ?? "")}`}
        amountLabel={amountLabel}
        paymentId={paymentId}
      />
    </HyperElements>
  );
}
