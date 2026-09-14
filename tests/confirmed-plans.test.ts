import test from "node:test";
import assert from "node:assert/strict";
import { applyConfirmedPlans } from "../lib/social/confirmed-plans.ts";
import { emptySnapshot, type Snapshot } from "../lib/social/types.ts";

test("acknowledged plans preserve the saved audience when refreshed content is unavailable", () => {
  const snapshot: Snapshot = {
    ...emptySnapshot,
    status: "ready",
    me: { id: "a", name: "A", username: "a", bio: "", communityLabel: "Test" },
    plans: [
      { userId: "a", name: "A", eventId: "e", status: "interested", audience: "only_me" },
      { userId: "b", name: "B", eventId: "e", status: "attending", audience: "friends" },
    ],
  };
  const confirmed = { userId: "a", eventId: "e", status: "attending", audience: "community" } as const;
  for (const source of [snapshot, { ...snapshot, plans: [] }]) {
    const updated = applyConfirmedPlans(source, [confirmed]);
    const mine = updated.plans.find((p) => p.userId === "a")!;
    assert.equal(mine.audience, "community");
    assert.equal(mine.status, "attending");
    const privateAgain = applyConfirmedPlans(updated, [{ ...confirmed, audience: "only_me" }]);
    assert.equal(privateAgain.plans.find((p) => p.userId === "a")!.audience, "only_me");
    const removed = applyConfirmedPlans(privateAgain, [{ ...confirmed, status: null }]);
    assert.ok(!removed.plans.some((p) => p.userId === "a"));
    assert.deepEqual(removed.plans, source.plans.filter((p) => p.userId !== "a"));
  }
  assert.equal(applyConfirmedPlans(snapshot, [{ ...confirmed, userId: "c" }]), snapshot);
  for (const status of ["signed_out", "onboarding"] as const) {
    const unavailable = { ...snapshot, status, plans: [] };
    assert.equal(applyConfirmedPlans(unavailable, [confirmed]), unavailable);
  }
});
