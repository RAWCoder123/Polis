import test from "node:test";
import assert from "node:assert/strict";
import { fixture, denied } from "./fixture.ts";
import { communityForEmail, pilotCommunities } from "../lib/social/communities.ts";
import { civicEntities, entityFor, entitiesFor, searchEntities } from "../lib/social/civic/index.ts";
import { itemById } from "../lib/polis-data.ts";
import { curatedEventsFor } from "../lib/social/campus-events.ts";
import { eventRecord, distanceMiles } from "../lib/social/events.ts";

// Synthetic local parts at the institutions' real domains: these fixtures are
// needed to exercise domain admission and are never contacted or published.
const campusEmails = {
  cu: "fixture.cu@cornell.edu",
  cu2: "fixture.cu2@cornell.edu",
  gator: "fixture.gator@ufl.edu",
  alum: "fixture.alum@alumni.cornell.edu",
  lookalike: "fixture@cornell.edu.example.test",
};

test("email domains map exactly to one configured campus", () => {
  assert.equal(communityForEmail("Student@CORNELL.EDU")?.id, "ithaca");
  assert.equal(communityForEmail("gator@ufl.edu")?.id, "uf");
  assert.equal(communityForEmail("fixture@alumni.cornell.edu"), undefined);
  assert.equal(communityForEmail("fixture@cornell.edu.example.test"), undefined);
  assert.equal(communityForEmail("fixture@notcornell.edu"), undefined);
  assert.equal(communityForEmail("no-at-sign"), undefined);
  // Emory remains invitation-only until its organizer configures domains.
  assert.equal(communityForEmail("fixture@emory.edu"), undefined);
});

test("an explicitly verified adapter university email joins the matching campus, and nothing a client sends can choose one", async () => {
  const f = fixture(campusEmails, { verifiedCampusEmail: true });
  const before = await f.snap("cu");
  assert.equal(before.status, "onboarding");
  assert.equal(before.eligibleCommunity?.id, "ithaca");

  const create = { action: "account.create" as const, name: "Cornell Fixture", username: "cu_fixture" };
  const id = crypto.randomUUID();
  const result = await f.act("cu", create, id);
  assert.equal(result.communityId, "ithaca");
  await f.act("cu", create, id);
  const cu = await f.snap("cu");
  assert.equal(cu.community!.id, "ithaca");
  assert.equal(cu.me!.role, "member");
  assert.equal(cu.me!.communityLabel, "Ithaca, NY");
  assert.deepEqual(cu.communities.map((c) => c.id).sort(), ["ithaca", "polis"]);
  assert.equal(cu.eligibleCommunity, null);

  await f.act("gator", { action: "account.create", name: "UF Fixture", username: "uf_fixture" });
  const gator = await f.snap("gator");
  assert.equal(gator.community!.id, "uf");
  assert.equal(gator.community!.campus!.city, "Gainesville");
  assert.deepEqual(gator.communities.map((c) => c.id).sort(), ["polis", "uf"]);
  await denied(f.snap("gator", { community: "ithaca" }), 403);
  await denied(f.act("gator", { action: "community.select", communityId: "ithaca" }), 403);
  await denied(f.act("gator", { action: "community.join", communityId: "ithaca" }), 403);

  for (const idOnly of ["alum", "lookalike"]) {
    await f.act(idOnly, { action: "account.create", name: idOnly, username: idOnly + "_fx" });
    const state = await f.snap(idOnly);
    assert.equal(state.community!.id, "polis");
    assert.deepEqual(state.communities.map((c) => c.id), ["polis"]);
    assert.equal(state.eligibleCommunity, null);
  }
  // The command schema has no campus field to forge.
  await denied(
    f.service("forged", "forged@example.test").execute({
      requestId: crypto.randomUUID(),
      data: { action: "account.create", name: "Forged", username: "forged_fx", communityId: "ithaca" },
    }),
    400,
  );
});

test("an existing profile with an explicit adapter assertion joins its email's campus; owners still enter other campuses through management", async () => {
  const f = fixture({}, { verifiedCampusEmail: true });
  await f.setup();
  await f.act("early", { action: "account.create", name: "Early", username: "early_fx" });
  // The same account later signs in with a verified campus email.
  const campusIdentity = f.service("early", "early@ufl.edu");
  const offered = await campusIdentity.snapshot(new URLSearchParams());
  assert.equal(offered.eligibleCommunity?.id, "uf");
  await campusIdentity.execute({ requestId: crypto.randomUUID(), data: { action: "community.join", communityId: "uf" } });
  const joined = await campusIdentity.snapshot(new URLSearchParams());
  assert.equal(joined.community!.id, "uf");
  assert.equal(joined.me!.username, "early_fx");
  assert.equal(joined.eligibleCommunity, null);

  await denied(f.act("a", { action: "community.join", communityId: "uf" }), 403);
  await denied(f.act("a", { action: "community.join", communityId: "polis" }), 404);

  // Domain association is not a management path; the owner keeps using Codex's
  // explicit community.manage action.
  await denied(f.act("owner", { action: "community.join", communityId: "uf" }), 403);
  await f.act("owner", { action: "community.manage", communityId: "uf" });
  const owner = await f.snap("owner");
  assert.equal(owner.community!.id, "uf");
  assert.equal(owner.me!.role, "owner");
  const [listing] = curatedEventsFor("uf");
  await f.act("owner", { action: "event.save", event: listing, createOnly: true });
  assert.ok((await campusIdentity.snapshot(new URLSearchParams())).events.some((e) => e.id === listing.id));
  // Cornell members never receive Gainesville listings.
  assert.ok(!(await f.snap("a")).events.some((e) => e.id === listing.id));
});

test("Commons posts carry titles and campus subjects; other campuses' subjects are rejected", async () => {
  const f = fixture(campusEmails, { verifiedCampusEmail: true });
  await f.act("cu", { action: "account.create", name: "Cornell Fixture", username: "cu_fixture" });
  await f.act("gator", { action: "account.create", name: "UF Fixture", username: "uf_fixture" });
  await denied(
    f.act("cu", { action: "post", kind: "question", subjectId: "cu-north-campus", text: "", audience: "community" }),
    400,
  );
  // A titled question can open with its headline alone.
  await f.act("cu", { action: "post", kind: "question", title: "Is the North Campus stop lit at night?", subjectId: "cu-north-campus", text: "", audience: "community" });
  const discussion = await f.act("cu", {
    action: "post",
    kind: "debate",
    title: "Where do you wait for the late bus?",
    subjectId: "cu-north-campus",
    text: "Trying to map the darkest stops.",
    audience: "community",
  });
  const [post] = (await f.snap("cu", { post: discussion.postId! })).posts;
  assert.equal(post.title, "Where do you wait for the late bus?");
  assert.equal(post.issueId, "cornell-transit");
  assert.equal(post.participantCount, 1);
  assert.equal((await f.snap("cu", { filter: "all", q: "darkest" })).posts.length, 1);
  assert.ok((await f.snap("cu", { filter: "all", q: "late bus" })).posts.some((p) => p.id === discussion.postId));

  await denied(f.act("gator", { action: "post", kind: "opinion", subjectId: "cu-north-campus", text: "Wrong campus", audience: "community" }), 400);
  await denied(f.act("gator", { action: "post", kind: "opinion", subjectId: "homes", text: "Legacy Ithaca item", audience: "community" }), 400);
  await denied(f.act("gator", { action: "follow", issueId: "cornell-transit", enabled: true, notify: false }), 400);
  await f.act("gator", { action: "follow", issueId: "uf-reitz-union", enabled: true, notify: false });
  await f.act("gator", { action: "post", kind: "opinion", subjectId: "q-uf-shade", position: "support", text: "Shade please.", audience: "community" });
  // Positions only where support/opposition is meaningful.
  await denied(f.act("gator", { action: "post", kind: "opinion", subjectId: "q-uf-university-ave", position: "support", text: "Open question", audience: "community" }), 400);
  await denied(f.act("gator", { action: "post", kind: "opinion", subjectId: "uf-reitz-union", position: "oppose", text: "A building", audience: "community" }), 400);
  await denied(f.snap("gator", { community: "ithaca", post: discussion.postId! }), 403);
});

test("structured questions count each person's latest perspective once, including replies", async () => {
  const f = fixture(campusEmails, { verifiedCampusEmail: true });
  for (const [id, name] of [["cu", "cu_fixture"], ["cu2", "cu_fixture2"]])
    await f.act(id, { action: "account.create", name, username: name });
  const response = await f.act("cu", {
    action: "post",
    kind: "opinion",
    subjectId: "q-cu-north-bus",
    position: "support",
    text: "My lab ends at 11.",
    audience: "community",
  });
  await f.act("cu2", { action: "comment", postId: response.postId!, text: "Costs worry me.", position: "reservations" });
  await f.act("cu2", { action: "comment", postId: response.postId!, text: "Actually the pilot seems fair.", position: "support" });
  await f.act("cu2", { action: "reaction", postId: response.postId!, kind: "disagree" });
  await f.act("cu2", { action: "reaction", postId: response.postId!, kind: "thoughtful" });

  const state = await f.snap("cu", { commons: "1", subject: "q-cu-north-bus" });
  assert.deepEqual(state.posts.map((p) => p.id), [response.postId]);
  assert.equal(state.posts[0].participantCount, 2);
  // One reaction per person: the later "Interesting" replaced "Disagree".
  assert.deepEqual(state.posts[0].reactions.map((r) => ({ ...r })), [{ kind: "thoughtful", count: 1 }]);
  const summary = state.commons!.questions.find((q) => q.id === "q-cu-north-bus")!;
  assert.equal(summary.responses, 1);
  assert.equal(summary.participants, 2);
  assert.deepEqual(summary.positions, [{ position: "support", count: 2 }]);
  const topic = state.commons!.topics.find((t) => t.subjectId === "q-cu-north-bus")!;
  assert.deepEqual([topic.posts, topic.replies, topic.participants], [1, 2, 2]);

  // Replies written in the same millisecond may tie on time, so match by text.
  const replies = (await f.snap("cu", { post: response.postId! })).comments!;
  const worried = replies.find((c) => c.text === "Costs worry me.")!;
  assert.equal(worried.position, "reservations");
  assert.equal(replies.find((c) => c.text === "Actually the pilot seems fair.")!.position, "support");
  await f.act("cu2", { action: "comment.edit", commentId: worried.id, text: "Edited", position: null });
  const edited = (await f.snap("cu", { post: response.postId! })).comments!.find((c) => c.id === worried.id)!;
  assert.equal(edited.position, null);

  // Open-ended questions and plain observations do not collect stances.
  const open = await f.act("cu", { action: "post", kind: "debate", subjectId: "q-ith-commons-evenings", text: "More music?", audience: "community" });
  await denied(f.act("cu2", { action: "comment", postId: open.postId!, text: "Yes", position: "support" }), 400);
  const observation = await f.act("cu", { action: "post", kind: "opinion", subjectId: "cu-olin-library", text: "Busy tonight.", audience: "community" });
  await denied(f.act("cu2", { action: "comment", postId: observation.postId!, text: "Agreed", position: "support" }), 400);
});

test("Commons scopes and legacy feed aliases use visible recency without exposing private notes", async () => {
  const f = fixture(campusEmails, { verifiedCampusEmail: true });
  for (const [id, name] of [["cu", "cu_fixture"], ["cu2", "cu_fixture2"]])
    await f.act(id, { action: "account.create", name, username: name });
  const campus = await f.act("cu", { action: "post", kind: "question", subjectId: "cu-olin-library", text: "Open late?", audience: "community" });
  const local = await f.act("cu", { action: "post", kind: "question", subjectId: "ith-commons", text: "Downtown tonight?", audience: "community" });
  const general = await f.act("cu", { action: "post", kind: "question", subjectId: "community", text: "Hello campus", audience: "community" });
  const privateNote = await f.act("cu", { action: "post", kind: "opinion", subjectId: "cu-olin-library", text: "Private", audience: "only_me" });

  const ids = async (filter: string, id = "cu") => (await f.snap(id, { filter })).posts.map((p) => p.id);
  assert.deepEqual((await ids("campus")).sort(), [campus.postId, general.postId].sort());
  assert.deepEqual(await ids("city"), [local.postId]);
  // Codex's local/national coverage still applies inside a tab.
  const national = await f.act("cu", { action: "post", kind: "debate", coverage: "national", subjectId: "community", title: "Student loan policy", text: "", audience: "community" });
  assert.ok((await f.snap("cu", { filter: "campus", coverage: "national" })).posts.every((p) => p.id === national.postId));
  assert.ok(!(await ids("for_you")).includes(privateNote.postId));
  assert.equal((await f.snap("cu", { filter: "for_you" })).nextCursor, null);
  // Old ranked URLs remain usable, now with the same chronological contract.
  assert.deepEqual(await ids("trending"), await ids("for_you"));
  await f.act("cu2", { action: "comment", postId: local.postId!, text: "Music on the Commons." });
  assert.ok((await ids("trending")).includes(local.postId));

  // Following combines followed subjects with accepted friends.
  assert.deepEqual(await ids("followed", "cu2"), []);
  await f.act("cu2", { action: "follow", issueId: "cu-olin-library", enabled: true, notify: false });
  assert.deepEqual(await ids("followed", "cu2"), [campus.postId]);
  // Your own threads appear once you follow them.
  await f.act("cu", { action: "conversation.follow", postId: local.postId!, enabled: true });
  assert.deepEqual(await ids("followed"), [local.postId]);
  const followed = (await f.snap("cu2")).follows.map((x) => x.issueId);
  assert.deepEqual(followed, ["cu-olin-library"]);
  await f.act("cu2", { action: "save", targetId: "q-cu-north-bus", enabled: true });
  assert.ok((await f.snap("cu2")).saved.includes("q-cu-north-bus"));
});

test("issue priorities are ordered within each campus", async () => {
  const f = fixture({ both: "fixture.both@cornell.edu" }, { verifiedCampusEmail: true });
  await f.act("both", { action: "account.create", name: "Both", username: "both_fx" });
  await f.act("both", { action: "priority.save", issueId: "housing" });
  await f.act("both", { action: "priority.save", issueId: "cornell-climate" });
  await f.act("owner", { action: "account.create", name: "Owner", username: "owner_fx" });
  await f.act("owner", { action: "community.manage", communityId: "uf" });
  const code = await f.act("owner", { action: "invite.code", communityId: "uf", expiresDays: 7, maxUses: 5 });
  await f.act("both", { action: "invite.redeem", invite: code.invitationCode!, confirmedCommunityId: "uf" });
  await f.act("both", { action: "priority.save", issueId: "uf-housing" });
  await denied(f.act("both", { action: "priority.save", issueId: "housing" }), 400);
  assert.deepEqual((await f.snap("both")).priorities.map((p) => p.issueId), ["uf-housing"]);
  await f.act("both", { action: "community.select", communityId: "ithaca" });
  await f.act("both", { action: "priority.order", issueIds: ["cornell-climate", "housing"] });
  assert.deepEqual((await f.snap("both")).priorities.map((p) => p.issueId), ["cornell-climate", "housing"]);
  await denied(f.act("both", { action: "priority.order", issueIds: ["cornell-climate", "housing", "uf-housing"] }), 400);
});

test("memorable, non-expiring invitation codes can be deactivated and reactivated", async () => {
  const f = fixture();
  await f.setup();
  const created = await f.act("owner", { action: "invite.code", communityId: "uf", code: "Polis UF", expiresDays: null, maxUses: null });
  assert.equal(created.invitationCode, "POLIS-UF");
  await denied(f.act("owner", { action: "invite.code", communityId: "ithaca", code: "polis-uf", expiresDays: 7, maxUses: 5 }), 409);
  await denied(f.act("owner", { action: "invite.code", communityId: "ithaca", code: "abc", expiresDays: 7, maxUses: 5 }), 400);
  const generated = await f.act("owner", { action: "invite.code", communityId: "ithaca", expiresDays: 30, maxUses: 5 });
  const codes = (await f.snap("owner")).admin!.invitationCodes;
  const memorable = codes.find((c) => c.label === "POLIS-UF")!;
  assert.equal(memorable.expiresAt.slice(0, 4), "9999");
  assert.equal(memorable.maxUses, null);
  // Secret generated codes are never listed back.
  assert.equal(codes.find((c) => c.id !== memorable.id)!.label, null);
  assert.ok(!JSON.stringify(codes).includes(generated.invitationCode!));

  const preview = await f.service(null).previewInvitation("polis-uf");
  assert.equal(preview.community.id, "uf");
  await f.act("owner", { action: "invite.revoke", codeId: memorable.id });
  await denied(f.service(null).previewInvitation("POLIS-UF"), 403);
  await f.act("owner", { action: "invite.reactivate", codeId: memorable.id });
  await f.act("newcomer", { action: "invite.redeem", invite: "POLIS UF", confirmedCommunityId: "uf", name: "Newcomer", username: "newcomer_fx" });
  const state = await f.snap("newcomer");
  assert.equal(state.community!.id, "uf");
  await denied(f.act("a", { action: "invite.reactivate", codeId: memorable.id }), 403);
});

test("the civic catalog is internally consistent, campus-scoped and honest about samples", () => {
  const ids = new Set<string>();
  for (const e of civicEntities) {
    assert.ok(!ids.has(e.id), "duplicate " + e.id);
    ids.add(e.id);
    const community = pilotCommunities.find((c) => c.id === e.communityId);
    assert.ok(community?.campus, e.id + " needs a campus community");
    for (const ref of [...e.related, ...e.topics]) {
      const target = entityFor(ref);
      assert.ok(target, e.id + " references missing " + ref);
      assert.equal(target!.communityId, e.communityId, e.id + " crosses campuses via " + ref);
    }
    for (const t of e.topics) assert.equal(entityFor(t)!.kind, "issue", e.id + " topic " + t);
    if (e.location) {
      const miles = distanceMiles(community!.campus!.center, [e.location.lat, e.location.lng]);
      assert.ok(miles < 5, e.id + " is " + miles.toFixed(1) + " miles from campus");
    }
    // Illustrative content is always labeled; offices never name an unchecked holder.
    if (["policy", "project", "news", "question"].includes(e.kind) && !e.checkedAt) assert.equal(e.sample, true, e.id);
    if (e.kind === "question") assert.ok(e.debate && e.debate.perspectives.length >= 2, e.id);
    // A named officeholder needs a checked source; a shown portrait needs its provenance.
    if (e.kind === "official") { assert.ok(e.office, e.id); if (e.office.officeholder) assert.ok(e.checkedAt && e.sourceUrl, e.id + " needs a checked source"); }
    if (e.imageUrl) assert.ok(e.imageCredit && e.imageSourceUrl, e.id + " needs checked portrait provenance");
    // Party appears only beside a checked officeholder.
    if (e.office?.party) assert.ok(e.office.officeholder && e.checkedAt, e.id + " party without a checked holder");
    if (e.sourceUrl) assert.match(e.sourceUrl, /^https:\/\//);
    assert.ok(!Object.hasOwn(itemById, e.id) || e.kind === "issue", e.id + " collides with a legacy item");
  }
  for (const communityId of ["ithaca", "uf"]) {
    const kinds = new Set(entitiesFor(communityId).map((e) => e.kind));
    for (const k of ["issue", "official", "building", "place", "policy", "news", "question", "meeting", "elections"])
      assert.ok(kinds.has(k as never), communityId + " lacks " + k);
  }
  assert.deepEqual(entitiesFor("emory"), []);
  assert.ok(searchEntities(entitiesFor("uf"), "housing").some((e) => e.id === "q-uf-midtown-housing"));
  assert.ok(!searchEntities(entitiesFor("uf"), "housing").some((e) => e.communityId !== "uf"));
});

test("curated campus listings validate and link only to their own campus issues", () => {
  const uf = curatedEventsFor("uf");
  assert.ok(uf.length >= 4);
  for (const e of [...uf, ...curatedEventsFor("ithaca")]) {
    assert.ok(eventRecord.safeParse(e).success, e.id);
    if (e.issueId) assert.equal(entityFor(e.issueId)?.kind, "issue", e.id);
    if (e.sample) assert.match(e.description, /sample/i, e.id);
  }
  for (const e of uf) {
    assert.equal(e.city, "Gainesville");
    assert.equal(e.sample, false);
    if (e.issueId) assert.equal(entityFor(e.issueId)!.communityId, "uf");
  }
  assert.deepEqual(curatedEventsFor("emory"), []);
});
