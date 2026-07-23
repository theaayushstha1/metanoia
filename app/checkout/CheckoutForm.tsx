"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useHyper, useWidgets, UnifiedCheckout } from "@juspay-tech/react-hyper-js";

/**
 * The card-collection form. Card data is rendered inside Hyperswitch's secure
 * iframe (UnifiedCheckout) and never touches our server.
 *
 * On inline success (no 3DS redirect) we navigate to the receipt ourselves; if
 * 3DS is required the SDK redirects to `returnUrl` (the same receipt page).
 */
export default function CheckoutForm({
  returnUrl,
  amountLabel,
  paymentId,
}: {
  returnUrl: string;
  amountLabel?: string;
  paymentId?: string;
}) {
  const router = useRouter();
  const hyper = useHyper();
  const widgets = useWidgets();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(false);

  function toReceipt(id?: string) {
    router.push(`/checkout/complete?payment_id=${encodeURIComponent(id ?? paymentId ?? "")}`);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hyper || !widgets || !authorized) return;
    setIsLoading(true);
    setMessage("");

    const response = await hyper.confirmPayment({
      widgets,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    const rid = (response as { payment_id?: string })?.payment_id;
    if (response?.status === "succeeded") {
      toReceipt(rid);
      return; // navigating away
    } else if (response?.error) {
      setMessage(response.error.message ?? "Payment failed.");
    } else if (response) {
      setMessage(`Status: ${response.status}`);
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <UnifiedCheckout
        id="unified-checkout"
        options={{
          wallets: { walletReturnUrl: returnUrl, applePay: "never", googlePay: "never" },
          // Surfaces Hyperswitch's own "save for future use" control. Ticking it is
          // what lets the SDK capture customer_acceptance and vault a reusable method
          // (payment_method_id) for the off-session renewal.
          displaySavedPaymentMethodsCheckbox: true,
        }}
      />
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "16px 0 0", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
          style={{ marginTop: 2, width: 16, height: 16, accentColor: "#2b6bf3", flex: "none" }}
        />
        <span className="font-mono" style={{ fontSize: 11, lineHeight: 1.5, color: "var(--muted)" }}>
          I authorize Metanoia to charge this card each month until I cancel. Also tick &ldquo;save for future
          use&rdquo; above to arm automatic renewal. Sandbox mode, cancel anytime.
        </span>
      </label>
      <button
        type="submit"
        disabled={!hyper || !widgets || isLoading || !authorized}
        className="font-body"
        style={{
          width: "100%",
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          background: "linear-gradient(180deg,#3d7bff,#2b6bf3)",
          border: "none",
          borderRadius: 11,
          padding: 15,
          boxShadow: "0 10px 26px rgba(43,107,243,.38)",
          cursor: isLoading ? "default" : "pointer",
          opacity: !hyper || !widgets || isLoading || !authorized ? 0.6 : 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {isLoading ? "Processing…" : `Pay ${amountLabel ?? ""}`.trim()}
      </button>
      {message && (
        <p className="font-mono" style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          {message}
        </p>
      )}
    </form>
  );
}
