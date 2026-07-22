"use client";

import { useEffect, useState } from "react";
import { loadHyper } from "@juspay-tech/hyper-js";
import { HyperElements } from "@juspay-tech/react-hyper-js";
import CheckoutForm from "./CheckoutForm";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_HYPERSWITCH_PUBLISHABLE_KEY ?? "";
const KEY_READY = Boolean(PUBLISHABLE_KEY) && !PUBLISHABLE_KEY.includes("PASTE");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Load HyperLoader once at module scope (this file is "use client", browser-only).
const hyperPromise = KEY_READY ? loadHyper(PUBLISHABLE_KEY) : undefined;

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
  const [options, setOptions] = useState<Record<string, unknown>>({});
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
        else
          setOptions({
            clientSecret: data.clientSecret,
            appearance: { theme: "default", variables: { colorPrimary: "#2b6bf3" } },
          });
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

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

  if (!hyperPromise || !("clientSecret" in options)) {
    return (
      <div className="font-mono" style={{ fontSize: 12.5, color: "var(--faint)", animation: "pulse 1.6s ease-in-out infinite" }}>
        Preparing secure checkout…
      </div>
    );
  }

  return (
    <HyperElements options={options} hyper={hyperPromise}>
      <CheckoutForm returnUrl={`${APP_URL}/checkout/complete`} amountLabel={amountLabel} />
    </HyperElements>
  );
}
