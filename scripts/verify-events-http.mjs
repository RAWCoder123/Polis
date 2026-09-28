import assert from "node:assert/strict";
import { officialEvents } from "../lib/social/official-events.ts";
// Isolated local D1 only. B and C are new run-scoped synthetic accounts, so the
// suite needs no earlier fixture and can repeat on the same database.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://127.0.0.1:5176";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const run = Date.now().toString(36);
const cookies = {};
for (const [u, a] of [
  ["a", "1"],
  ["b", "qa_events_" + run + "_b"],
  ["c", "qa_events_" + run + "_c"],
]) {
  const r = await fetch(origin + "/signin-with-chatgpt?test_account=" + a, {
    redirect: "manual",
  });
  assert.equal(r.status, 302);
  cookies[u] = r.headers.get("set-cookie").split(";")[0];
}
async function read(u, params = {}) {
  const r = await fetch(origin + "/api/polis?" + new URLSearchParams(params), {
    headers: { Cookie: cookies[u] },
  });
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  return body;
}
async function act(u, data, status = 200, requestId = crypto.randomUUID()) {
  const r = await fetch(origin + "/api/polis", {
    method: "POST",
    headers: {
      Cookie: cookies[u],
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId, data }),
  });
  const body = await r.json();
  assert.equal(r.status, status, JSON.stringify(body));
  return body;
}
// The pilot owner curates Ithaca; B and C join it with single-use codes, and
// B opts in to reply notifications and becomes the owner's friend.
if ((await read("a")).status === "onboarding")
  await act("a", { action: "account.create", name: "Local owner", username: "events_owner" });
await act("a", { action: "community.manage", communityId: "ithaca" });
for (const [u, name] of [["b", "Events Blair"], ["c", "Events Casey"]]) {
  const { invitationCode } = await act("a", { action: "invite.code", communityId: "ithaca", maxUses: 1 });
  await act(u, { action: "join", invite: invitationCode, confirmedCommunityId: "ithaca", name, username: "events_" + run + "_" + u });
}
assert.equal(
  new Set(await Promise.all(["a", "b", "c"].map(async (u) => (await read(u)).me.id))).size,
  3,
  "Start with POLIS_TEST_ACCOUNTS=1; test identities must be isolated.",
);
await act("b", { action: "preferences", replies: true, reactions: true, issues: true, events: false });
await act("a", { action: "friend", targetId: (await read("b")).me.id, operation: "request" });
await act("b", { action: "friend", targetId: (await read("a")).me.id, operation: "accept" });
for (const e of officialEvents)
  await act("a", { action: "event.save", event: e, createOnly: true });
for (const e of officialEvents)
  await act("a", { action: "event.save", event: e, createOnly: true });
// Keep organizer import checks separate from a durable synthetic RSVP fixture.
// Real September listings eventually end; their dates must never be rewritten.
const event = {
  ...officialEvents[0],
  id: "synthetic-http-garden", seriesId: "synthetic-http-series",
  title: "SYNTHETIC integration garden visit", description: "Local HTTP fixture only.",
  organizer: "Test organizer", sourceUrl: "https://example.test/fixture",
  startsAt: "2099-09-20T14:00:00.000Z", endsAt: "2099-09-20T15:00:00.000Z",
  registrationUrl: "https://example.test/fixture", sample: true, status: "published",
};
await act("a", { action: "event.save", event });
// Other suites may add their own listings to this database; each official
// listing must still be imported exactly once, however often it is saved.
const imported = (await read("a")).events.filter((e) => officialEvents.some((o) => o.id === e.id));
assert.equal(imported.length, officialEvents.length);
await act("b", {
  action: "event.preferences",
  city: "Ithaca",
  interests: ["outdoors", "food_markets"],
});
assert.deepEqual((await read("b")).eventPreferences.interests, [
  "outdoors",
  "food_markets",
]);
await act(
  "b",
  { action: "event.status", eventId: event.id, status: "canceled" },
  403,
);
const save = { action: "save", targetId: event.id, enabled: true };
const saveId = crypto.randomUUID();
await act("b", save, 200, saveId);
await act("b", save, 200, saveId);
assert.ok((await read("b")).saved.includes(event.id));
assert.ok(!(await read("c")).saved.includes(event.id));
const plan = {
  action: "plan",
  eventId: event.id,
  status: "attending",
  audience: "only_me",
};
const rid = crypto.randomUUID();
await act("b", plan, 200, rid);
await act("b", plan, 200, rid);
assert.equal(
  (await read("b")).plans.filter((p) => p.eventId === event.id).length,
  1,
);
assert.equal(
  (await read("a")).plans.filter((p) => p.eventId === event.id).length,
  0,
);
assert.equal(
  (await read("c")).plans.filter((p) => p.eventId === event.id).length,
  0,
);
await act("a", { ...plan, userId: (await read("b")).me.id }, 400);
await act("b", { ...plan, audience: "friends" });
const shared = (await read("a", { event: event.id, filter: "all" })).posts.find(
  (p) => p.kind === "event_plan",
);
assert.ok(shared);
const reply = await act("a", {
  action: "comment",
  postId: shared.id,
  text: "SYNTHETIC TEST · Where should we meet?",
});
assert.ok(
  (await read("b")).notifications.some((n) => n.commentId === reply.commentId),
);
const response = await act("b", {
  action: "comment",
  postId: shared.id,
  parentId: reply.commentId,
  text: "SYNTHETIC TEST · At the welcome center.",
});
assert.ok(
  (
    await read("a", { post: shared.id, comment: response.commentId })
  ).comments.some((c) => c.id === response.commentId),
);
assert.equal(
  (await read("c", { event: event.id, filter: "all" })).posts.some(
    (p) => p.id === shared.id,
  ),
  false,
);
await act("b", { ...plan, audience: "only_me" });
assert.equal(
  (await read("a")).plans.filter((p) => p.eventId === event.id).length,
  0,
);
await act("b", {
  action: "event.suggest",
  title: "SYNTHETIC TEST suggestion",
  sourceUrl: "https://example.test/review",
  note: "Please review the fixture.",
});
assert.ok(
  (await read("a")).eventSuggestions.some(
    (s) => s.title === "SYNTHETIC TEST suggestion",
  ),
);
await act("b", {
  action: "report",
  targetId: event.id,
  reason: "SYNTHETIC TEST · review listing details",
});
assert.ok(
  (await read("a")).admin.reports.some((r) =>
    r.reason.includes("SYNTHETIC TEST"),
  ),
);
console.log(
  "PASS local D1 HTTP: " + officialEvents.length + " repeatable official imports; independent synthetic identities; persistent interests, saves, private/friends RSVP, exact replies and notification links, ownership denial, suggestions and moderation. No hosted identities verified.",
);
