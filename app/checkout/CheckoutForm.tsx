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
  onRetry,
}: {
  returnUrl: string;
  amountLabel?: string;
  paymentId?: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const hyper = useHyper();
  const widgets = useWidgets();
  const [isLoading, setIsLoading] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: "error" | "info"; title: string; detail: string } | null>(null);
  const [authorized, setAuthorized] = useState(false);

  function toReceipt(id?: string) {
    router.push(`/checkout/complete?payment_id=${encodeURIComponent(id ?? paymentId ?? "")}`);
  }

  // Pull the real decline reason straight from Hyperswitch (never guessed).
  async function liveReason(id?: string): Promise<{ code: string | null; message: string | null }> {
    try {
      const r = await fetch("/api/lab/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: id ?? paymentId ?? "" }),
      });
      if (!r.ok) return { code: null, message: null };
      const d = (await r.json()) as { error_code?: string | null; error_message?: string | null };
      return { code: d.error_code ?? null, message: d.error_message ?? null };
    } catch {
      return { code: null, message: null };
    }
  }

  function declineHeadline(code: string | null, message: string | null): string {
    const hay = `${code ?? ""} ${message ?? ""}`.toLowerCase();
    if (hay.includes("insufficient")) return "Declined — insufficient funds";
    if (hay.includes("expired")) return "Declined — card expired";
    if (hay.includes("cvc") || hay.includes("cvv") || hay.includes("security code")) return "Declined — wrong security code";
    if (hay.includes("do not honor") || hay.includes("does not support")) return "Declined by the issuer";
    if (hay.includes("declin")) return "Declined by the issuer";
    return "Payment failed";
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hyper || !widgets || !authorized) return;
    setIsLoading(true);
    setOutcome(null);

    const response = await hyper.confirmPayment({
      widgets,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    const rid = (response as { payment_id?: string })?.payment_id;
    const status = response?.status;

    if (status === "succeeded") {
      toReceipt(rid);
      return; // navigating away
    }

    if (status === "requires_customer_action") {
      setOutcome({
        tone: "info",
        title: "Extra authentication needed",
        detail: "This card requires a 3-D Secure challenge before it can be charged.",
      });
      setIsLoading(false);
      return;
    }

    // Any other terminal state is a decline/failure. Get the genuine reason.
    const inline = response?.error?.message ?? null;
    const { code, message } = await liveReason(rid);
    const reason = message ?? inline;
    setOutcome({
      tone: "error",
      title: declineHeadline(code, reason),
      detail:
        [reason, code ? `code ${code}` : null].filter(Boolean).join(" · ") ||
        "The issuer declined this charge. No money moved.",
    });
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
      {outcome && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 11,
            padding: "13px 15px",
            borderRadius: 11,
            background: outcome.tone === "error" ? "var(--red-bg)" : "var(--accent-bg)",
            border: `1px solid ${outcome.tone === "error" ? "var(--red)" : "var(--blue)"}`,
          }}
        >
          <span style={{ flex: "none", marginTop: 1 }}>
            {outcome.tone === "error" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              className="font-body"
              style={{ fontSize: 13.5, fontWeight: 700, color: outcome.tone === "error" ? "var(--red)" : "var(--blue)" }}
            >
              {outcome.title}
            </div>
            <div className="font-mono" style={{ marginTop: 3, fontSize: 11, lineHeight: 1.5, color: "var(--muted)", wordBreak: "break-word" }}>
              {outcome.detail}
            </div>
            {outcome.tone === "error" && (
              <>
                <div className="font-mono" style={{ marginTop: 6, fontSize: 10, letterSpacing: ".04em", color: "var(--faint)" }}>
                  NO CHARGE · CARD NEVER STORED
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="font-body"
                    style={{ marginTop: 11, fontSize: 12.5, fontWeight: 600, color: "#fff", background: "var(--red)", border: "none", borderRadius: 9, padding: "9px 16px", cursor: "pointer" }}
                  >
                    Try another card
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
