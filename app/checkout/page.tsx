import CheckoutClient from "./CheckoutClient";
import { getPlan, formatUsd } from "@/lib/catalog";

/**
 * Minimal checkout page (Day-1 spine). This is the "real completed payment"
 * surface; the agentic war-room UI is layered on next.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planId = "tickstream_pro" } = await searchParams;
  const plan = getPlan(planId);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Metanoia · checkout</p>
        <h1 className="mt-1 text-2xl font-semibold">{plan?.name ?? "Subscription"}</h1>
        {plan && (
          <p className="mt-1 text-sm text-neutral-400">
            {plan.vendor} · {formatUsd(plan.priceCents)}/mo · {plan.category}
          </p>
        )}
      </div>
      <CheckoutClient planId={planId} />
      <p className="text-xs text-neutral-600">
        Sandbox. Test card 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </main>
  );
}
