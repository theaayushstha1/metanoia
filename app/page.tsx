import Workbench from "./Workbench";
import { getIntentMandate, getSubscriptions } from "@/lib/store";
import { DEMO_CUSTOMER } from "@/lib/constants";

export default function Home() {
  const { policy } = getIntentMandate();
  const subscriptions = getSubscriptions(DEMO_CUSTOMER);
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
