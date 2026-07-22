"use client";

import { FormEvent, useState } from "react";
import { useHyper, useWidgets, UnifiedCheckout } from "@juspay-tech/react-hyper-js";

/**
 * The card-collection form. Card data is rendered inside Hyperswitch's secure
 * iframe (UnifiedCheckout) and never touches our server.
 *
 * Note: Hyperswitch's confirmPayment takes `widgets` (not Stripe's `elements`).
 */
export default function CheckoutForm({ returnUrl }: { returnUrl: string }) {
  const hyper = useHyper();
  const widgets = useWidgets();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hyper || !widgets) return;
    setIsLoading(true);
    setMessage("");

    const response = await hyper.confirmPayment({
      widgets,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (response?.status === "succeeded") {
      setMessage("Payment successful. Mandate active — the agent can renew this off-session.");
    } else if (response?.error) {
      setMessage(response.error.message ?? "Payment failed.");
    } else if (response) {
      setMessage(`Status: ${response.status}`);
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <UnifiedCheckout id="unified-checkout" options={{}} />
      <button
        type="submit"
        disabled={!hyper || !widgets || isLoading}
        className="w-full rounded-lg bg-[#3b4cff] px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {isLoading ? "Processing…" : "Pay & authorize renewals"}
      </button>
      {message && <p className="text-sm text-neutral-300">{message}</p>}
    </form>
  );
}
