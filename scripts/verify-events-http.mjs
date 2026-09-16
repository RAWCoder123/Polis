import assert from "node:assert/strict";
import { officialEvents } from "../lib/social/official-events.ts";
// Isolated local D1 only. Run test:social-http first to establish synthetic memberships.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://127.0.0.1:5176";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const cookies = {};
for (const [u, a] of [
  ["a", "1"],
  ["b", "beta_b"],
  ["c", "beta_c"],
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
for (const e of officialEvents)
  await act("a", { action: "event.save", event: e, createOnly: true });
for (const e of officialEvents)
  await act("a", { action: "event.save", event: e, createOnly: true });
const event = officialEvents.find(
  (e) => e.id === "cornell-garden-tour-2026-09-20",
);
assert.equal((await read("a")).events.filter((e) => !e.sample).length, 17);
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
  "PASS local D1 HTTP: 17 repeatable official imports; independent synthetic identities; persistent interests, saves, private/friends RSVP, exact replies and notification links, ownership denial, suggestions and moderation. No hosted identities verified.",
);
