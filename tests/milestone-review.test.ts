import test from "node:test";
import assert from "node:assert/strict";
import { fixture, denied } from "./fixture.ts";
import { checkedEventsFor } from "../lib/social/campus-events.ts";
import { discoverEvents, eventRecord } from "../lib/social/events.ts";

const occurrence = (campus: string) => eventRecord.parse({ ...checkedEventsFor(campus).find(e => e.scope === "campus")!, id: "fixture-venue-" + campus, seriesId: "fixture-series-" + campus, title: "Synthetic shared-plan test", startsAt: "2099-09-20T20:00:00.000Z", endsAt: "2099-09-20T22:00:00.000Z", latitude: campus === "uf" ? 29.65 : 42.45, longitude: campus === "uf" ? -82.34 : -76.48, sample: true });

test("a Sites email string alone cannot admit a campus member or enable an email join", async () => {
  const f = fixture({ unverified: "fixture@cornell.edu" });
  assert.equal((await f.snap("unverified")).eligibleCommunity, null);
  await f.act("unverified", { action: "account.create", name: "Fixture", username: "fixture" });
  const state = await f.snap("unverified");
  assert.deepEqual(state.communities.map(c => c.id), ["polis"]);
  assert.equal(state.community!.id, "polis");
  await denied(f.act("unverified", { action: "community.join", communityId: "ithaca" }), 403);
  await denied(f.service("unverified").execute({ requestId: crypto.randomUUID(), data: { action: "account.create", name: "Fixture", username: "fixture", verifiedCampusEmail: true } }), 400);
});

test("three identities per campus: private, shared, muted, blocked and ended plans have consistent server projections", async () => {
  const f = fixture();
  await f.act("owner", { action: "account.create", name: "Owner", username: "owner" });
  for (const campus of ["ithaca", "uf"]) {
    await f.act("owner", { action: "community.manage", communityId: campus });
    const invite = await f.act("owner", { action: "invite.code", communityId: campus, expiresDays: 1, maxUses: 3 });
    const [a, b, c] = ["a", "b", "c"].map(v => campus + "_" + v);
    for (const id of [a, b, c]) await f.act(id, { action: "invite.redeem", invite: invite.invitationCode!, confirmedCommunityId: campus, name: id, username: id });
    await f.act(a, { action: "friend", targetId: b, operation: "request" });
    await f.act(b, { action: "friend", targetId: a, operation: "accept" });
    const event = occurrence(campus);
    await f.act("owner", { action: "event.save", event });
    await f.act(a, { action: "plan", eventId: event.id, status: "attending" });
    assert.deepEqual((await f.snap(b)).venuePlans, []);
    assert.deepEqual((await f.snap(c)).venuePlans, []);
    const requestId = crypto.randomUUID();
    for (let i = 0; i < 2; i++) await f.act(a, { action: "plan", eventId: event.id, status: "attending", audience: "friends" }, requestId);
    assert.equal((await f.snap(b)).venuePlans!.filter(p => p.userId === a).length, 1);
    assert.deepEqual((await f.snap(c)).venuePlans, []);
    await f.act(b, { action: "mute", targetId: a, enabled: true });
    assert.deepEqual((await f.snap(b)).venuePlans, []);
    await f.act(b, { action: "mute", targetId: a, enabled: false });
    await f.act(b, { action: "block", targetId: a, enabled: true });
    assert.deepEqual((await f.snap(b)).venuePlans, []);
    await f.act(b, { action: "block", targetId: a, enabled: false });
    await f.act(a, { action: "friend", targetId: b, operation: "request" });
    await f.act(b, { action: "friend", targetId: a, operation: "accept" });
    await f.act("owner", { action: "event.status", eventId: event.id, status: "canceled" });
    assert.deepEqual((await f.snap(b)).venuePlans, []);
    await f.act("owner", { action: "event.save", event: { ...event, startsAt: "2020-01-01T20:00:00.000Z", endsAt: "2020-01-01T22:00:00.000Z" } });
    assert.deepEqual((await f.snap(b)).venuePlans, []);
    assert.equal((await f.snap(a)).plans.filter(p => p.eventId === event.id).length, 1, "own history remains private and available");
    await denied(f.act(c, { action: "event.save", event }), 403);
  }
  assert.ok(!(await f.snap("uf_a")).events.some(e => e.campusId === "ithaca"));
});

test("Across Polis needs explicit membership, preserves campus and never carries campus replies", async () => {
  const f = fixture(); await f.setup();
  const local = await f.act("a", { action: "post", kind: "question", title: "Local discussion", coverage: "national", subjectId: "community", text: "National issue within my campus", audience: "friends" });
  await f.friends();
  await f.act("b", { action: "comment", postId: local.postId!, text: "A private campus reply" });
  assert.equal((await f.snap("a", { coverage: "national", scope: "polis" })).nationalJoined, false);
  await f.act("a", { action: "community.joinNational" });
  await f.act("b", { action: "community.joinNational" });
  assert.equal((await f.snap("a")).me!.activeCommunityId, "ithaca");
  const across = await f.service("a").execute({ requestId: crypto.randomUUID(), communityId: "polis", data: { action: "post", coverage: "national", title: "Wider discussion", kind: "question", text: "An explicitly new post", subjectId: "community", audience: "community" } });
  const wider = await f.snap("b", { scope: "polis", coverage: "national", filter: "community" });
  assert.deepEqual(wider.posts.map(p => p.id), [across.postId]);
  assert.equal(wider.posts[0].replyCount, 0);
  assert.equal(wider.me!.activeCommunityId, "ithaca");
  await denied(f.snap("c", { community: "polis", post: across.postId! }), 403);
  await denied(f.snap("b", { community: "polis", post: local.postId! }), 404);
});

test("muted replies do not appear in direct replies, counts, recent activity or topic summaries", async () => {
  const f = fixture(); await f.setup();
  const p = await f.act("a", { action: "post", kind: "question", subjectId: "cornell-transit", text: "Service question", audience: "community" });
  const reply = await f.act("c", { action: "comment", postId: p.postId!, text: "My answer" });
  await f.act("b", { action: "mute", targetId: "c", enabled: true });
  const state = await f.snap("b", { post: p.postId!, comment: reply.commentId!, commons: "1" });
  assert.equal(state.comments!.length, 0);
  assert.equal(state.posts[0].replyCount, 0);
  assert.equal(state.posts[0].participantCount, 1);
  assert.equal(state.commentUnavailable, true);
  assert.equal(state.commons!.topics.find(t => t.subjectId === "cornell-transit")!.replies, 0);
});

test("campus/town filters use verified associations rather than a category guess", () => {
  for (const campus of ["ithaca", "uf"]) {
    const events = checkedEventsFor(campus), city = campus === "uf" ? "Gainesville" : "Ithaca";
    const preferences = { city, interests: [], complete: true };
    const now = new Date("2026-09-27T10:00:00Z");
    const campusEvents = discoverEvents(events, preferences, { scope: "campus", campusId: campus }, now);
    const town = discoverEvents(events, preferences, { scope: "town", campusId: campus }, now);
    assert.ok(campusEvents.length >= 2, campus + " needs two sourced campus occurrences");
    assert.ok(town.length >= 2, campus + " needs two sourced town occurrences");
    assert.ok(campusEvents.every(({ event }) => event.campusId === campus && !event.sample));
    assert.ok(town.every(({ event }) => event.scope === "town" && !event.sample));
  }
});

test("recent activity pagination returns every visible thread once, including tied timestamps", async () => {
  const f = fixture(); await f.setup();
  const ids: string[] = [];
  for (let i = 0; i < 25; i++) {
    const p = await f.act("a", { action: "post", kind: "question", subjectId: "community", text: "Synthetic page " + i, audience: "community" });
    ids.push(p.postId!);
    f.raw.prepare("UPDATE posts SET createdAt=? WHERE id=?").run("2026-01-01T00:00:00.000Z", p.postId!);
  }
  await f.act("c", { action: "comment", postId: ids[0], text: "Visible recent activity" });
  const first = await f.snap("b", { filter: "all", sort: "active" });
  assert.equal(first.posts[0].id, ids[0]);
  assert.equal(first.posts.length, 20);
  assert.ok(first.nextCursor);
  const second = await f.snap("b", { filter: "all", sort: "active", cursor: first.nextCursor! });
  assert.equal(second.posts.length, 5);
  assert.equal(second.nextCursor, null);
  const returned = [...first.posts, ...second.posts].map(p => p.id);
  assert.equal(new Set(returned).size, 25);
  assert.deepEqual(new Set(returned), new Set(ids));
});
