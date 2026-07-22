import Link from "next/link";
import { getPayment } from "@/lib/hyperswitch";
import { confirmPaid } from "@/lib/checkout";

/**
 * Return target after the SDK finishes (incl. any 3DS redirect).
 *
 * Success is determined ONLY by an authoritative server-side retrieval of the
 * payment — never by a `?status=` query param (which the client could spoof).
 */
export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ payment_id?: string }>;
}) {
  const { payment_id } = await searchParams;

  let verifiedStatus: string | null = null;
  let mandateActive = false;
  let verifyError: string | null = null;

  if (payment_id) {
    try {
      const p = await getPayment(payment_id);
      verifiedStatus = p.status;
      mandateActive = Boolean(p.mandate_id || p.payment_method_id);
      if (p.status === "succeeded") {
        confirmPaid(payment_id, { paymentMethodId: p.payment_method_id });
      }
    } catch (e) {
      verifyError = e instanceof Error ? e.message : "Could not verify payment";
    }
  }

  const ok = verifiedStatus === "succeeded";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-16 text-center">
      <div className={`text-5xl ${ok ? "" : "grayscale"}`}>{ok ? "✅" : "⌛"}</div>
      <h1 className="text-2xl font-semibold">
        {ok
          ? "Payment complete"
          : payment_id
            ? `Payment ${verifiedStatus ?? "unverified"}`
            : "No payment to verify"}
      </h1>
      {payment_id && <p className="text-xs text-neutral-500">Payment ID: {payment_id}</p>}
      {verifyError && <p className="text-xs text-red-300">Could not verify: {verifyError}</p>}
      {ok && mandateActive && (
        <p className="text-sm text-neutral-400">
          Mandate active. The agent can now attempt off-session renewals for this subscription.
        </p>
      )}
      <Link href="/" className="mt-4 text-sm text-[#7c8bff] underline">
        Back to Metanoia
      </Link>
    </main>
  );
}
