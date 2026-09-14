import type { PlanConfirmation, Snapshot } from "./types.ts";

// Only acknowledged writes can enter this overlay. It never supplies another
// person's activity, and an authorized GET replaces it with current server data.
export function applyConfirmedPlans(
  snapshot: Snapshot,
  confirmations: Iterable<PlanConfirmation>,
): Snapshot {
  if (snapshot.status !== "ready" || !snapshot.me) return snapshot;
  const me = snapshot.me;
  let plans = snapshot.plans;
  for (const confirmation of confirmations) {
    if (confirmation.userId !== me.id) continue;
    plans = plans.filter(
      (p) => p.userId !== me.id || p.eventId !== confirmation.eventId,
    );
    if (confirmation.status)
      plans = [...plans, {
        userId: me.id,
        name: me.name,
        eventId: confirmation.eventId,
        status: confirmation.status,
        audience: confirmation.audience,
      }];
  }
  return plans === snapshot.plans ? snapshot : { ...snapshot, plans };
}
