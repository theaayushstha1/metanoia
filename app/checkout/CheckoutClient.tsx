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
export default function CheckoutClient({ planId }: { planId: string }) {
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
        else setOptions({ clientSecret: data.clientSecret, appearance: { theme: "midnight" } });
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
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!hyperPromise || !("clientSecret" in options)) {
    return <div className="animate-pulse text-sm text-neutral-400">Preparing secure checkout…</div>;
  }

  return (
    <HyperElements options={options} hyper={hyperPromise}>
      <CheckoutForm returnUrl={`${APP_URL}/checkout/complete`} />
    </HyperElements>
  );
}
