import Workbench from "./Workbench";
import { getIntentMandate } from "@/lib/store";

export default function Home() {
  const { policy } = getIntentMandate();
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <Workbench
        mandate={{
          monthly: policy.monthly_cap_cents,
          perCharge: policy.per_charge_cap_cents,
          maxSubs: policy.max_active_subscriptions ?? 0,
        }}
      />
    </main>
  );
}
