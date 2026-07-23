import Workbench from "./Workbench";
import { getSubscriptions } from "@/lib/store";
import { getSessionCustomerId } from "@/lib/session";
import { getSessionIntentMandate } from "@/lib/mandate-session";

export default async function Home() {
  const { policy } = await getSessionIntentMandate();
  const subscriptions = await getSubscriptions(await getSessionCustomerId());
  const spent = subscriptions.reduce((total, subscription) => total + subscription.amount_cents, 0);
  return (
    <main style={{ minHeight: "100vh" }}>
      <Workbench
        mandate={{
          monthly: policy.monthly_cap_cents,
          perCharge: policy.per_charge_cap_cents,
          maxSubs: policy.max_active_subscriptions ?? 0,
          spent,
          active: subscriptions.length,
        }}
      />
    </main>
  );
}
