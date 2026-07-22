import Workbench from "./Workbench";
import { getIntentMandate } from "@/lib/store";

export default function Home() {
  const { policy } = getIntentMandate();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#7c8bff]">
          Autonomous procurement · Juspay Hyperswitch
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
          Give your agent a budget, not your card.
        </h1>
        <p className="mt-4 text-lg text-neutral-400">
          Describe a capability your product needs. Metanoia searches a curated vendor
          marketplace, compares offers, checks your spending mandate, and proposes one
          subscription to approve, refusing anything outside budget or policy.
          <span className="text-neutral-600"> (Prototype · Hyperswitch sandbox.)</span>
        </p>
      </header>

      <Workbench
        mandate={{
          monthly: policy.monthly_cap_cents,
          perCharge: policy.per_charge_cap_cents,
          maxSubs: policy.max_active_subscriptions ?? 0,
        }}
      />

      <footer className="mt-16 border-t border-neutral-900 pt-6 text-xs text-neutral-600">
        Prototype · Hyperswitch sandbox · Gemini 2.5 Pro on Vertex · sandbox test card only.
      </footer>
    </main>
  );
}
