import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetMemory,
  setConsent,
  addEvent,
  addFact,
  snapshotMemory,
  clearMemory,
} from "@/lib/memory/store";
import { deriveProfile } from "@/lib/memory/profile";
import { getPlan } from "@/lib/catalog";

const C = "mem_test_customer";

beforeEach(async () => {
  await __resetMemory();
});

describe("consent gate", () => {
  it("stores nothing until consent is granted", async () => {
    await addFact(C, { kind: "stack", value: "Next.js" });
    await addEvent(C, { capability: "market-data", planId: "tickstream_pro", action: "selected", amountCents: 2900 });

    let snap = await snapshotMemory(C);
    expect(snap.consent).toBe(false);
    expect(snap.facts).toHaveLength(0);
    expect(snap.events).toHaveLength(0);

    await setConsent(C, true);
    await addFact(C, { kind: "stack", value: "Next.js" });
    snap = await snapshotMemory(C);
    expect(snap.facts).toHaveLength(1);
  });

  it("dedupes identical facts", async () => {
    await setConsent(C, true);
    await addFact(C, { kind: "stack", value: "Next.js" });
    await addFact(C, { kind: "stack", value: "Next.js" });
    expect((await snapshotMemory(C)).facts).toHaveLength(1);
  });
});

describe("deriveProfile", () => {
  it("is empty with no history and defaults to balanced", async () => {
    await setConsent(C, true);
    const p = deriveProfile(await snapshotMemory(C));
    expect(p.hasHistory).toBe(false);
    expect(p.priorityLean).toBe("balanced");
  });

  it("learns preferred vendor and typical budget from a selection", async () => {
    await setConsent(C, true);
    const plan = getPlan("tickstream_pro")!;
    await addEvent(C, {
      capability: "market-data",
      planId: plan.id,
      action: "selected",
      amountCents: plan.priceCents,
    });
    const p = deriveProfile(await snapshotMemory(C));
    expect(p.hasHistory).toBe(true);
    expect(p.preferredVendors).toContain(plan.vendor);
    expect(p.typicalBudgetCents).toBe(plan.priceCents);
    expect(["cost", "balanced", "reliability", "throughput"]).toContain(p.priorityLean);
  });

  it("records an avoided vendor from a rejection", async () => {
    await setConsent(C, true);
    const rej = getPlan("realtime_ultra")!;
    await addEvent(C, { capability: "market-data", planId: rej.id, action: "rejected" });
    const p = deriveProfile(await snapshotMemory(C));
    expect(p.avoidedVendors).toContain(rej.vendor);
  });

  it("is deterministic for the same snapshot", async () => {
    await setConsent(C, true);
    await addEvent(C, { capability: "news", planId: "newsfeed_ai", action: "selected", amountCents: 1500 });
    const snap = await snapshotMemory(C);
    expect(deriveProfile(snap)).toEqual(deriveProfile(snap));
  });
});

describe("deletion", () => {
  it("forgets everything on clear", async () => {
    await setConsent(C, true);
    await addFact(C, { kind: "domain", value: "fintech" });
    await addEvent(C, { capability: "news", planId: "newsfeed_ai", action: "selected", amountCents: 1500 });
    await clearMemory(C);
    const snap = await snapshotMemory(C);
    expect(snap.facts).toHaveLength(0);
    expect(snap.events).toHaveLength(0);
  });
});
