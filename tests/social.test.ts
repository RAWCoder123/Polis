import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import type { CommandData } from "../lib/social/service.ts";
import { fixture, denied } from "./fixture.ts";

// Real migration SQL and service code; only the D1 transport is adapted to SQLite.
test("open signup creates a persistent ordinary account without consuming a community invitation", async () => {
  const f = fixture();
  const command = { action: "account.create" as const, name: "New member", username: "new_member" };
  const requestId = crypto.randomUUID();
  await f.act("new", command, requestId);
  await f.act("new", command, requestId);
  await f.act("new", { ...command, name: "Should not overwrite", username: "other_name" });
  const state = await f.snap("new");
  assert.equal(state.status, "ready");
  assert.equal(state.me!.name, "New member");
  assert.equal(state.me!.role, "member");
  assert.equal(state.community!.id, "polis");
  assert.deepEqual(state.communities.map(c => c.id), ["polis"]);
  assert.equal(f.count("profiles"), 1);
  assert.equal(f.count("community_memberships"), 1);
  assert.equal(f.count("invitation_redemptions"), 0);
  await assert.rejects(f.snap("new", { community: "ithaca" }), { status: 403 });
  await assert.rejects(f.act("new", { action: "community.select", communityId: "emory" }), { status: 403 });
  await assert.rejects(f.service(null).execute({ requestId: crypto.randomUUID(), data: command }), { status: 401 });
  await assert.rejects(f.service("forged").execute({ requestId: crypto.randomUUID(), communityId: "emory", data: { ...command, role: "owner" } }), { status: 400 });
});

test("open accounts converse while invitation-only content and administrative operations stay protected", async () => {
  const f = fixture(); await f.setup();
  const privatePost = await f.post("community");
  for (const id of ["open_a", "open_b"]) await f.act(id, { action: "account.create", name: id, username: id });
  await assert.rejects(f.snap("open_a", { community: "ithaca", post: privatePost }), { status: 403 });
  await assert.rejects(f.act("open_a", { action: "invite.code", expiresDays: 7, maxUses: 5 }), { status: 403 });
  const p = await f.act("open_a", { action: "post", kind: "question", subjectId: "community", text: "What matters in your neighborhood?", audience: "community" });
  await f.act("open_a", { action: "preferences", replies: true, reactions: false, issues: false, events: false });
  assert.ok((await f.snap("open_b", { filter: "community" })).posts.some(x => x.id === p.postId));
  await f.act("open_b", { action: "comment", postId: p.postId, text: "A space to meet neighbors." });
  assert.equal((await f.snap("open_a", { post: p.postId })).comments!.length, 1);
  assert.ok((await f.snap("open_a")).notifications.some(n => n.targetId === p.postId));
});

test("optional invitation joins a second community without replacing an open account or double counting", async () => {
  const f = fixture(); await f.setup();
  await f.act("new", { action: "account.create", name: "Open member", username: "open_member" });
  const code = await f.act("owner", { action: "invite.code", communityId: "emory", expiresDays: 7, maxUses: 5 });
  const redeem = { action: "invite.redeem" as const, invite: code.invitationCode, confirmedCommunityId: "emory" };
  await f.act("new", redeem); await f.act("new", redeem);
  const state = await f.snap("new");
  assert.equal(state.me!.username, "open_member");
  assert.deepEqual(state.communities.map(c => c.id).sort(), ["emory", "polis"]);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes WHERE communityId='emory'").get()!.useCount, 1);
  await f.act("new", { action: "community.joinOpen" });
  assert.equal((await f.snap("new")).community!.id, "polis");
});

test("username conflicts roll back signup and existing profiles can explicitly enter the commons", async () => {
  const f = fixture(); await f.setup();
  await assert.rejects(f.act("new", { action: "account.create", name: "New", username: "owner" }), { status: 409 });
  assert.equal((await f.snap("new")).status, "onboarding");
  await f.act("a", { action: "account.create", name: "Other", username: "different_name" });
  assert.equal((await f.snap("a")).community!.id, "ithaca");
  await f.act("a", { action: "community.joinOpen" });
  const state = await f.snap("a");
  assert.equal(state.me!.username, "person_a");
  assert.deepEqual(state.communities.map(c => c.id).sort(), ["ithaca", "polis"]);
});


test("organization codes require campus membership, preserve private threads and revoke access atomically", async () => {
  const f = fixture(); await f.setup();
  for (const campus of ["ithaca", "uf"]) {
    const org = campus === "ithaca" ? "cornell-circle" : "uf-circle";
    await f.act("owner", { action: "community.manage", communityId: campus });
    const invitation = await f.act("owner", { action: "invite.code", communityId: campus });
    for (const suffix of ["a", "b", "c"]) {
      const user = campus + "_org_" + suffix;
      await f.act(user, { action: "invite.redeem", invite: invitation.invitationCode, confirmedCommunityId: campus, name: user, username: user });
    }
    const [a,b,c] = [campus + "_org_a", campus + "_org_b", campus + "_org_c"];
    await f.act("owner", { action: "organization.member", organizationId: org, userId: a, role: "organizer" });
    const code = await f.act(a, { action: "invite.code", organizationId: org, maxUses: 1 });
    const preview = await f.service(b).previewInvitation(code.invitationCode);
    assert.equal(preview.organization!.id, org);
    await assert.rejects(f.act("outsider", { action: "invite.redeem", invite: code.invitationCode, confirmedCommunityId: campus, name: "Outsider", username: "outsider" }), { status: 403 });
    await f.act(b, { action: "invite.redeem", invite: code.invitationCode, confirmedCommunityId: campus });
    await f.act(b, { action: "invite.redeem", invite: code.invitationCode, confirmedCommunityId: campus });
    await assert.rejects(f.act(c, { action: "invite.redeem", invite: code.invitationCode, confirmedCommunityId: campus }), { status: 403 });
    const s = await f.snap(a, { organization: org });
    assert.equal(s.organizationCodes![0].useCount, 1);
    assert.equal((await f.snap(b, { organization: org })).organizations!.find(o => o.id === org)!.role, "member");
    await assert.rejects(f.act(b, { action: "invite.code", organizationId: org }), { status: 403 });
    await assert.rejects(f.act(b, { action: "organization.member", organizationId: org, userId: b, role: "organizer" }), { status: 403 });
    const postData = { action: "post" as const, organizationId: org, organizationChannel: "announcements" as const, audience: "community" as const, subjectId: "community", kind: "question" as const, text: "Organization fixture announcement" };
    await assert.rejects(f.act(b, postData), { status: 403 });
    const p = await f.act(a, postData);
    await f.act(b, { action: "comment", postId: p.postId, text: "Private organization response" });
    await f.act(b, { action: "save", targetId: p.postId, enabled: true });
    await f.act(b, { action: "conversation.follow", postId: p.postId, enabled: true });
    assert.equal((await f.snap(a, { filter: "community" })).posts.some(p2 => p2.id === p.postId), false);
    await assert.rejects(f.snap(c, { post: p.postId }), { status: 404 });
    await assert.rejects(f.snap(c, { organization: org }), { status: 404 });
    const copied = await f.act(a, { action: "post", kind: "question", audience: "community", subjectId: "community", text: postData.text });
    assert.equal((await f.snap(c, { post: copied.postId })).posts[0].replyCount, 0);
    await assert.rejects(f.act(a, { ...postData, organizationId: null, priorPostId: p.postId }), { status: 400 });
    await f.act(b, { action: "report", targetId: p.postId, reason: "Organization test report" });
    assert.equal((await f.snap("owner")).admin!.reports.length, 1);
    await f.act(a, { action: "invite.revoke", codeId: s.organizationCodes![0].id });
    await f.act("owner", { action: "organization.member", organizationId: org, userId: b, role: "remove" });
    await assert.rejects(f.snap(b, { post: p.postId }), { status: 404 });
    assert.equal((await f.snap(b, { filter: "saved" })).posts.some(p2 => p2.id === p.postId), false);
    await assert.rejects(f.act(b, { action: "invite.redeem", invite: code.invitationCode, confirmedCommunityId: campus }), { status: 403 });
    const racing = await f.act(a, { action: "invite.code", organizationId: org });
    let injected = false;
    f.hooks.batch = async rows => {
      if (!injected && rows.some(r => r.sql.includes("invitation_redemptions"))) {
        injected = true;
        f.raw.prepare("UPDATE invitation_codes SET revokedAt=? WHERE organizationId=?").run(new Date().toISOString(), org);
      }
    };
    await assert.rejects(f.act(c, { action: "invite.redeem", invite: racing.invitationCode, confirmedCommunityId: campus }), { status: 409 });
    f.hooks.batch = null;
    assert.equal((await f.snap(c)).organizations!.find(o => o.id === org)!.role, null);
  }
});

test("three identities per campus complete Commons replies, follows, updates and isolated switching", async () => {
  const f = fixture(); await f.setup();
  const postIds: Record<string, string> = {};
  for (const campus of ["ithaca", "uf"]) {
    await f.act("owner", { action: "community.manage", communityId: campus });
    const code = await f.act("owner", { action: "invite.code", communityId: campus, maxUses: 3 });
    for (const suffix of ["a", "b", "c"]) {
      const actor = campus + "_" + suffix;
      await f.act(actor, { action: "invite.redeem", invite: code.invitationCode, confirmedCommunityId: campus, name: actor, username: actor });
      assert.equal((await f.snap(actor)).preferences.replies, 0);
      await f.act(actor, { action: "preferences", replies: true, reactions: false, issues: true, events: false });
    }
    const [a, b, c] = [campus + "_a", campus + "_b", campus + "_c"];
    const topic = campus === "uf" ? "uf-transit" : "cornell-transit";
    const otherTopic = campus === "uf" ? "cornell-transit" : "uf-transit";
    await assert.rejects(f.act(a, { action: "follow", issueId: otherTopic, enabled: true }), { status: 400 });
    await assert.rejects(f.act(a, { action: "community.manage", communityId: "uf" }), { status: 403 });
    const p = await f.act(a, { action: "post", kind: "debate", subjectId: topic, text: "How could our commute improve?", audience: "community", position: "learning" });
    postIds[campus] = p.postId;
    await f.act(c, { action: "conversation.follow", postId: p.postId, enabled: true });
    const reply = await f.act(b, { action: "comment", postId: p.postId, text: "More reliable connections." });
    assert.ok((await f.snap(a)).notifications.some(n => n.commentId === reply.commentId));
    assert.ok((await f.snap(c)).notifications.some(n => n.commentId === reply.commentId));
    assert.equal((await f.snap(a, { post: p.postId, comment: reply.commentId })).comments![0].text, "More reliable connections.");
    await f.act(c, { action: "conversation.visit", postId: p.postId });
    await f.act(c, { action: "conversation.visit", postId: p.postId });
    assert.equal(f.raw.prepare("SELECT COUNT(*) n FROM metrics WHERE event='conversation_return' AND communityId=?").get(campus)!.n, 1);
    await f.act(c, { action: "follow", issueId: topic, enabled: true, notify: true });
    await f.act("owner", { action: "issue.update", issueId: topic, title: "A fixture update with an original source", sourceUrl: "https://example.org/fixture", sample: true });
    assert.equal((await f.snap(c)).updates.filter(u => u.issueId === topic).length, 1);
    await f.act(a, { action: "friend", targetId: b, operation: "request" });
    await f.act(b, { action: "friend", targetId: a, operation: "accept" });
    const privatePost = await f.act(a, { action: "post", kind: "question", subjectId: topic, text: "Private question", audience: "friends" });
    await assert.rejects(f.snap(c, { post: privatePost.postId }), { status: 404 });
    await f.act(c, { action: "block", targetId: b, enabled: true });
    assert.equal((await f.snap(c, { post: p.postId })).posts[0].replyCount, 0);
    assert.equal((await f.snap(c)).notifications.some(n => n.commentId === reply.commentId), false);
    await f.act(b, { action: "report", targetId: p.postId, reason: "A fixture moderation report" });
    assert.equal((await f.snap("owner")).admin!.reports.length, 1);
  }
  for (const [viewer, campus] of [["ithaca_a", "uf"], ["uf_a", "ithaca"]]) {
    await assert.rejects(f.snap(viewer, { post: postIds[campus] }), { status: 404 });
    await assert.rejects(f.snap(viewer, { community: campus }), { status: 403 });
  }
  await f.act("owner", { action: "community.select", communityId: "ithaca" });
  const cornellCode = await f.act("owner", { action: "invite.code", communityId: "ithaca" });
  await assert.rejects(f.act("uf_a", { action: "invite.redeem", invite: cornellCode.invitationCode, confirmedCommunityId: "uf" }), { status: 400 });
  await f.act("uf_a", { action: "invite.redeem", invite: cornellCode.invitationCode, confirmedCommunityId: "ithaca" });
  assert.equal((await f.snap("uf_a")).community!.id, "ithaca");
  await assert.rejects(f.snap("uf_a", { post: postIds.uf }), { status: 404 });
  await f.act("uf_a", { action: "community.select", communityId: "uf" });
  assert.equal((await f.snap("uf_a", { post: postIds.uf })).posts[0].communityId, "uf");
});

test("activation metrics count shared contributions and both friendship participants, without private text", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  assert.deepEqual(
    f.raw
      .prepare(
        "SELECT userId FROM metrics WHERE event='friend_accepted' ORDER BY userId",
      )
      .all()
      .map((r) => r.userId),
    ["a", "b"],
  );
  const p = await f.post("only_me");
  await f.act("a", {
    action: "comment",
    postId: p,
    parentId: null,
    text: "Private scratch note",
  });
  assert.equal(
    f.raw
      .prepare(
        "SELECT COUNT(*) n FROM metrics WHERE event IN ('post_created','reply_created')",
      )
      .get()!.n,
    0,
  );
  await f.act("a", {
    action: "ranking",
    itemId: "homes",
    score: 7,
    note: "Private ranking note",
    position: "mixed",
  });
  await f.act("a", {
    action: "ranking.share",
    itemIds: ["homes"],
    title: "Selection",
    text: "",
    audience: "friends",
  });
  await f.act("a", {
    action: "answer",
    questionId: "sample-housing",
    choice: "Still learning",
    note: "",
    audience: "friends",
  });
  assert.equal(
    f.raw
      .prepare("SELECT COUNT(*) n FROM metrics WHERE event='post_created'")
      .get()!.n,
    2,
  );
  const first = crypto.randomUUID();
  await f.act("a", { action: "visit" }, first);
  await f.act("a", { action: "visit" }, first);
  await f.act("a", { action: "visit" });
  assert.equal(
    f.raw
      .prepare(
        "SELECT COUNT(*) n FROM metrics WHERE userId='a' AND event='active_day'",
      )
      .get()!.n,
    1,
  );
  assert.ok(
    !JSON.stringify(f.raw.prepare("SELECT * FROM metrics").all()).includes(
      "Private",
    ),
  );
});

test("reading a reaction group marks only this recipient and post", async () => {
  const f = fixture();
  await f.setup();
  const p1 = await f.post("community"),
    p2 = await f.post("community");
  for (const user of ["b", "c"])
    await f.act(user, { action: "reaction", postId: p1, kind: "thoughtful" });
  await f.act("b", { action: "reaction", postId: p2, kind: "curious" });
  await f.act("b", { action: "notifications.read", postId: p1 });
  assert.equal(
    (await f.snap("a")).notifications.filter((n) => !n.readAt).length,
    3,
  );
  await f.act("a", { action: "notifications.read", postId: p1 });
  const notices = (await f.snap("a")).notifications;
  assert.equal(notices.filter((n) => n.targetId === p1 && n.readAt).length, 2);
  assert.equal(notices.filter((n) => n.targetId === p2 && !n.readAt).length, 1);
});

test("invited identity, membership, and owner authority stay server-derived", async () => {
  const f = fixture();
  await f.setup();
  assert.equal((await f.snap(null)).status, "signed_out");
  await denied(
    f
      .service(null)
      .execute({ requestId: crypto.randomUUID(), data: { action: "visit" } }),
    401,
  );
  await denied(
    f.act("outsider", {
      action: "join",
      name: "Outsider",
      username: "outsider",
    }),
    403,
  );
  await denied(
    f.act("a", { action: "invite", email: "outsider@example.test" }),
    403,
  );
  await f.act("a", {
    action: "profile",
    name: "A",
    bio: "Hello",
    communityLabel: "Another town",
  });
  assert.equal(
    f.raw
      .prepare("SELECT communityId FROM memberships WHERE userId=?")
      .get("a")!.communityId,
    "ithaca",
  );
  await denied(
    f.service("a").execute({
      requestId: crypto.randomUUID(),
      data: {
        action: "profile",
        name: "A",
        bio: "",
        communityLabel: "Ithaca",
        role: "owner",
      },
    }),
    400,
  );
  const key = crypto.randomUUID(),
    join = { action: "join", name: "New", username: "new_user" };
  const inv = await f.act("owner", {
    action: "invite",
    email: "new@example.test",
  });
  const input = { requestId: key, data: { ...join, invite: inv.invite } };
  assert.deepEqual(
    await f.service("new").execute(input),
    await f.service("new").execute(input),
  );
});

test("A and B converse; C cannot retrieve Friends content through any query or mutation", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const p = await f.post();
  const reply = await f.act("b", {
    action: "comment",
    postId: p,
    text: "A reply",
  });
  const nested = await f.act("a", {
    action: "comment",
    postId: p,
    parentId: reply.commentId,
    text: "Thanks",
  });
  assert.equal((await f.snap("b", { post: p })).comments!.length, 2);
  assert.equal(
    (await f.snap("a")).notifications.find((n) => n.kind === "reply")!
      .commentId,
    reply.commentId,
  );
  await denied(
    f.act("b", {
      action: "comment",
      postId: p,
      parentId: nested.commentId,
      text: "Too deep",
    }),
    400,
  );
  for (const query of [
    { post: p },
    { filter: "all" },
    { filter: "community" },
    { filter: "all", author: "a" },
    { filter: "all", issue: "housing" },
    { filter: "all", q: "Test contribution" },
    { filter: "saved" },
  ] as Record<string, string>[]) {
    if (query.post) await denied(f.snap("c", query), 404);
    else assert.equal((await f.snap("c", query)).posts.length, 0);
  }
  for (const data of [
    { action: "comment", postId: p, text: "No" },
    { action: "reaction", postId: p, kind: "agree" },
    { action: "save", targetId: p, enabled: true },
  ] as CommandData[])
    await denied(f.act("c", data), 404);
  await denied(
    f.act("b", { action: "post.edit", postId: p, text: "Not mine" }),
    403,
  );
  await denied(
    f.service("a").execute({
      requestId: crypto.randomUUID(),
      data: {
        action: "post.edit",
        postId: p,
        text: "Widen",
        audience: "community",
      },
    }),
    400,
  );
});

test("idempotent writes, one reaction, exact reply links, edits and deletion persist across service instances", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const p = await f.post();
  const requestId = crypto.randomUUID(),
    data: CommandData = { action: "comment", postId: p, text: "Once" };
  const [x, y] = await Promise.all([
    f.act("b", data, requestId),
    f.act("b", data, requestId),
  ]);
  assert.deepEqual(x, y);
  assert.equal(f.count("comments"), 1);
  await denied(f.act("b", { ...data, text: "Different" }, requestId), 409);
  await f.act("b", { action: "reaction", postId: p, kind: "agree" });
  await f.act("b", { action: "reaction", postId: p, kind: "curious" });
  let a = await f.snap("a", { post: p });
  assert.deepEqual(
    a.posts[0].reactions.map((r) => [r.kind, r.count]),
    [["curious", 1]],
  );
  assert.equal(a.notifications.filter((n) => n.kind === "reaction").length, 1);
  await f.act("b", { action: "save", targetId: p, enabled: true });
  assert.ok((await f.snap("b")).saved.includes(p));
  await f.act("a", { action: "post.edit", postId: p, text: "Edited" });
  await f.act("b", {
    action: "comment.edit",
    commentId: x.commentId,
    text: "Edited reply",
  });
  a = await f.snap("a", { post: p });
  assert.equal(a.posts[0].text, "Edited");
  assert.equal(a.comments![0].text, "Edited reply");
  await f.act("b", { action: "comment.delete", commentId: x.commentId });
  assert.equal((await f.snap("a", { post: p })).comments!.length, 0);
  await f.act("a", { action: "post.delete", postId: p });
  await denied(f.snap("b", { post: p }), 404);
  assert.ok(!(await f.snap("b")).saved.includes(p));
  assert.equal((await f.snap("a")).notifications.length, 1); // accepted friendship remains
});

test("unfriending revokes deep links, saves, lists and plans; blocking removes mutual visibility", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const p = await f.post();
  await f.act("b", { action: "save", targetId: p, enabled: true });
  await f.act("a", {
    action: "plan",
    eventId: "housing-meeting",
    status: "attending",
    audience: "friends",
  });
  assert.equal((await f.snap("b")).plans.length, 1);
  await f.act("b", { action: "friend", targetId: "a", operation: "remove" });
  await denied(f.snap("b", { post: p }), 404);
  assert.equal((await f.snap("b")).plans.length, 0);
  assert.equal((await f.snap("b")).saved.length, 0);
  const community = await f.post("community");
  assert.equal((await f.snap("c", { post: community })).posts.length, 1);
  await f.act("a", { action: "block", targetId: "c", enabled: true });
  await denied(f.snap("c", { post: community }), 404);
  assert.ok(!(await f.snap("c")).people.some((p) => p.id === "a"));
  await denied(
    f.act("c", { action: "friend", targetId: "a", operation: "request" }),
    404,
  );
});

test("muting suppresses feeds and notifications; reports are owner-only", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const p = await f.post("community");
  await f.act("b", { action: "mute", targetId: "a", enabled: true });
  assert.equal((await f.snap("b", { filter: "all" })).posts.length, 0);
  assert.equal((await f.snap("b", { post: p })).posts.length, 1);
  await f.act("b", {
    action: "report",
    targetId: p,
    reason: "Test moderation report",
  });
  assert.equal((await f.snap("c")).admin, undefined);
  const report = (await f.snap("owner")).admin!.reports[0];
  assert.match(report.evidence, /Test contribution/);
  await denied(
    f.act("b", {
      action: "report.resolve",
      reportId: report.id,
      removeContent: true,
    }),
    403,
  );
  await f.act("owner", {
    action: "report.resolve",
    reportId: report.id,
    removeContent: true,
  });
  await denied(f.snap("a", { post: p }), 404);
});

test("rankings stay private, priority is separate, published snapshots contain selected fields only", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  for (const itemId of ["homes", "buses", "parks"])
    await f.act("a", {
      action: "ranking",
      itemId,
      score: 8,
      note: "Private note",
      position: "mixed",
    });
  await f.act("a", {
    action: "ranking.order",
    itemIds: ["parks", "buses", "homes"],
  });
  assert.equal((await f.snap("a")).rankings[0].itemId, "parks");
  assert.equal((await f.snap("a")).rankings[0].score, 8);
  const result = await f.act("a", {
    action: "ranking.share",
    itemIds: ["parks", "homes"],
    title: "My selection",
    text: "",
    audience: "friends",
  });
  const before = (await f.snap("b")).lists![0].itemsJson;
  const rows = JSON.parse(before);
  assert.deepEqual(
    rows.map((r: { priority: number }) => r.priority),
    [0, 1],
  );
  assert.ok(!before.includes("note"));
  assert.ok(!before.includes("buses"));
  assert.equal((await f.snap("b")).rankings.length, 0);
  await f.act("a", {
    action: "ranking",
    itemId: "homes",
    score: 2,
    note: "Changed privately",
    position: "oppose",
  });
  assert.equal((await f.snap("b")).lists![0].itemsJson, before);
  await denied(f.snap("c", { post: result.postId }), 404);
});

test("follows affect eligibility; plans synchronize while private plans never become activity", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  await f.post("community");
  assert.equal((await f.snap("b", { filter: "following" })).posts.length, 0);
  await f.act("b", {
    action: "follow",
    issueId: "housing",
    enabled: true,
    notify: true,
  });
  assert.equal((await f.snap("b", { filter: "following" })).posts.length, 1);
  await f.act("owner", {
    action: "issue.update",
    issueId: "housing",
    title: "Illustrative milestone",
    sourceUrl: "https://www.cityofithaca.org/",
    sample: true,
  });
  assert.ok((await f.snap("b")).notifications.some((n) => n.kind === "issue"));
  await f.act("a", {
    action: "plan",
    eventId: "housing-meeting",
    status: "interested",
  });
  assert.equal((await f.snap("b")).plans.length, 0);
  assert.equal((await f.snap("a")).plans[0].status, "interested");
  await f.act("a", {
    action: "plan",
    eventId: "housing-meeting",
    status: "attending",
    audience: "friends",
  });
  assert.equal((await f.snap("b")).plans[0].status, "attending");
  assert.ok((await f.snap("b")).posts.some((p) => p.kind === "event_plan"));
  await f.act("a", {
    action: "plan",
    eventId: "housing-meeting",
    status: null,
  });
  assert.equal((await f.snap("b")).plans.length, 0);
  assert.ok(!(await f.snap("b")).posts.some((p) => p.kind === "event_plan"));
});

test("daily answers are private by default, result counts enforce audience, skip stays private", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  await f.act("a", {
    action: "answer",
    questionId: "sample-housing",
    choice: "Still learning",
    note: "Private reason",
  });
  assert.equal((await f.snap("a")).answer!.note, "Private reason");
  assert.equal((await f.snap("c")).question!.counts!.length, 0);
  assert.equal((await f.snap("b")).posts.length, 0);
  await f.act("a", {
    action: "answer",
    questionId: "sample-housing",
    choice: "Still learning",
    note: "Shared reason",
    audience: "friends",
  });
  assert.equal((await f.snap("b")).question!.counts![0].count, 1);
  assert.equal((await f.snap("c")).question!.counts!.length, 0);
  await f.act("a", {
    action: "answer",
    questionId: "sample-housing",
    choice: "skip",
    note: "",
    audience: "community",
  });
  assert.equal((await f.snap("a")).answer!.audience, "only_me");
  assert.equal((await f.snap("c")).question!.counts!.length, 0);
});

test("unchanged event plans retain their conversation; changed audiences start a new one", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const plan = {
    action: "plan",
    eventId: "transit-walk",
    status: "attending",
    audience: "friends",
  } as const;
  const first = await f.act("a", plan);
  assert.deepEqual(first.plan, {
    userId: "a",
    eventId: plan.eventId,
    status: plan.status,
    audience: plan.audience,
  });
  const postId = first.postId!;
  await f.act("b", {
    action: "comment",
    postId,
    text: "Meet at the entrance?",
    parentId: null,
  });
  await f.act("b", { action: "reaction", postId, kind: "thoughtful" });
  await f.act("a", plan);
  const preserved = (await f.snap("b", { post: postId })).posts[0];
  assert.equal(preserved.id, postId);
  assert.equal(preserved.replyCount, 1);
  assert.equal(preserved.reactions[0].count, 1);
  assert.equal(f.count("posts"), 1);
  const wider = await f.act("a", { ...plan, audience: "community" });
  assert.notEqual(wider.postId, postId);
  assert.equal(
    (await f.snap("c", { post: wider.postId! })).posts[0].replyCount,
    0,
  );
  await denied(f.snap("b", { post: postId }), 404);
  const removed = await f.act("a", { ...plan, status: null });
  assert.deepEqual(removed.plan, {
    userId: "a",
    eventId: plan.eventId,
    status: null,
    audience: "only_me",
  });
});

test("post/reply cursor pages and exact deep links include replies beyond the first page", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const p = await f.post();
  for (let i = 0; i < 206; i++)
    await f.act("b", { action: "comment", postId: p, text: "Reply " + i });
  const first = await f.snap("a", { post: p });
  assert.equal(first.comments!.length, 100);
  const seen = new Set(first.comments!.map((c) => c.id));
  let cursor = first.nextCommentCursor;
  while (cursor) {
    const s = await f.snap("a", { post: p, commentsAfter: cursor });
    s.comments!.forEach((c) => seen.add(c.id));
    cursor = s.nextCommentCursor;
  }
  assert.equal(seen.size, 206);
  const last = f.raw
    .prepare("SELECT id FROM comments ORDER BY createdAt DESC,id DESC LIMIT 1")
    .get()!.id as string;
  assert.ok(
    (await f.snap("a", { post: p, comment: last })).comments!.some(
      (c) => c.id === last,
    ),
  );
  for (let i = 0; i < 25; i++) await f.post("community");
  const page = await f.snap("c", { filter: "community" });
  assert.equal(page.posts.length, 20);
  const more = await f.snap("c", {
    filter: "community",
    cursor: page.nextCursor!,
  });
  assert.equal(more.posts.length, 5);
  assert.equal(
    new Set([...page.posts, ...more.posts].map((p) => p.id)).size,
    25,
  );
});

function pauseOnce(f: ReturnType<typeof fixture>, pattern: string) {
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    atGate = new Promise<void>((r) => (arrived = r));
  f.hooks.batch = async (rows) => {
    if (!rows.some((s) => s.sql.startsWith(pattern))) return;
    f.hooks.batch = null;
    arrived();
    await gate;
  };
  return { release, atGate };
}

test("transaction guard rejects reply if access is revoked before commit; all related writes roll back", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const p = await f.post();
  const gate = pauseOnce(f, "INSERT INTO comments");
  const reply = f.act("b", { action: "comment", postId: p, text: "Delayed" });
  await gate.atGate;
  await f.act("a", { action: "block", targetId: "b", enabled: true });
  gate.release();
  await denied(reply, 409);
  assert.equal(f.count("comments"), 0);
  assert.equal(f.count("write_guards"), 0);
});

test("a withdrawn daily question cannot accept an in-flight answer", async () => {
  const f = fixture();
  await f.setup();
  const gate = pauseOnce(f, "INSERT INTO answers");
  const pending = f.act("a", {
    action: "answer",
    questionId: "sample-housing",
    choice: "Still learning",
    note: "",
    audience: "community",
  });
  await gate.atGate;
  const q = (await f.snap("owner")).admin!.questions[0];
  await f.act("owner", {
    action: "question.save",
    questionId: q.id,
    issueId: q.issueId,
    title: q.title,
    background: q.background,
    sourceUrl: q.sourceUrl,
    sample: !!q.sample,
    options: JSON.parse(q.optionsJson),
    startsAt: q.startsAt,
    endsAt: q.endsAt,
    status: "withdrawn",
  });
  gate.release();
  await denied(pending, 409);
  assert.equal(f.count("answers"), 0);
  assert.equal(f.count("posts"), 0);
});

test("an invitation can be consumed only once, even across simultaneous identities with the same email", async () => {
  const f = fixture();
  await f.setup();
  const inv = await f.act("owner", {
    action: "invite",
    email: "same@example.test",
  });
  const gate = pauseOnce(f, "INSERT INTO profiles");
  const first = f.service("first", "same@example.test").execute({
    requestId: crypto.randomUUID(),
    data: {
      action: "join",
      name: "First",
      username: "first",
      invite: inv.invite,
    },
  });
  await gate.atGate;
  await f.service("second", "same@example.test").execute({
    requestId: crypto.randomUUID(),
    data: {
      action: "join",
      name: "Second",
      username: "second",
      invite: inv.invite,
    },
  });
  gate.release();
  await denied(first, 409);
  assert.equal(
    f.raw
      .prepare("SELECT COUNT(*) n FROM profiles WHERE id IN ('first','second')")
      .get()!.n,
    1,
  );
});

test("issue opinions accept safe sources, preserve them on text edits, and reject unsafe links", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const result = await f.act("a", {
    action: "post",
    kind: "opinion",
    subjectId: "transit",
    position: "learning",
    text: "Learning about buses",
    sourceUrl: "https://tcatbus.com/",
  });
  await f.act("a", {
    action: "post.edit",
    postId: result.postId!,
    text: "Updated view",
    position: "mixed",
  });
  const p = (await f.snap("b", { post: result.postId! })).posts[0];
  assert.equal(p.position, "mixed");
  assert.equal(JSON.parse(p.attachmentJson).sourceUrl, "https://tcatbus.com/");
  for (const sourceUrl of [
    "javascript:alert(1)",
    "https://user:password@example.test/",
    "not a URL",
  ])
    await denied(
      f.act("a", {
        action: "post",
        kind: "opinion",
        subjectId: "transit",
        text: "link",
        sourceUrl,
      }),
      400,
    );
  const article = await f.act("a", {
    action: "post",
    kind: "article",
    subjectId: "transit",
    text: "An article with context",
    sourceUrl: "https://example.test/article",
  });
  assert.ok(article.postId);
  await denied(
    f.act("a", {
      action: "post.edit",
      postId: article.postId!,
      text: "Article context",
      sourceUrl: "",
    }),
    400,
  );
  await denied(
    f.act("a", {
      action: "post",
      kind: "article",
      subjectId: "transit",
      text: "No article link",
    }),
    400,
  );
});

test("unknown and prototype-named civic items cannot become saved items or rankings", async () => {
  const f = fixture();
  await f.setup();
  for (const itemId of [
    "constructor",
    "__proto__",
    "toString",
    "unknown-item",
  ]) {
    await denied(
      f.act("a", { action: "save", targetId: itemId, enabled: true }),
      404,
    );
    await denied(
      f.act("a", { action: "ranking", itemId, score: 5, note: "" }),
      400,
    );
    await denied(
      f.act("a", { action: "plan", eventId: itemId, status: "interested" }),
      404,
    );
  }
  assert.equal(f.count("saves"), 0);
  assert.equal(f.count("rankings"), 0);

  // Older unsupported records must not poison the profile or saved-items response.
  f.raw.exec("INSERT INTO saves(userId,targetId) VALUES('a','constructor')");
  f.raw.exec(
    "INSERT INTO rankings(userId,itemId,score,note,priority) VALUES('a','constructor',5,'',0)",
  );
  await f.act("a", {
    action: "save",
    targetId: "housing-meeting",
    enabled: true,
  });
  await f.act("a", { action: "ranking", itemId: "homes", score: 7, note: "" });
  const snapshot = await f.snap("a");
  assert.deepEqual(snapshot.saved, ["housing-meeting"]);
  assert.deepEqual(
    snapshot.rankings.map((r) => r.itemId),
    ["homes"],
  );
  await denied(
    f.act("a", {
      action: "ranking.share",
      itemIds: ["constructor"],
      title: "Invalid item",
      text: "",
    }),
    400,
  );
});

test("friend request and reply inboxes deduplicate, honor access, and support unread state", async () => {
  const f = fixture();
  await f.setup();
  const request = crypto.randomUUID();
  for (let i = 0; i < 2; i++)
    await f.act(
      "a",
      { action: "friend", targetId: "b", operation: "request" },
      request,
    );
  assert.equal(
    (await f.snap("b")).notifications.filter((n) => n.kind === "friend_request")
      .length,
    1,
  );
  await f.act("b", { action: "friend", targetId: "a", operation: "accept" });
  assert.equal(
    (await f.snap("b")).notifications.filter((n) => n.kind === "friend_request")
      .length,
    0,
  );
  const p = await f.post("community");
  const top = await f.act("b", {
    action: "comment",
    postId: p,
    text: "Question",
  });
  const rid = crypto.randomUUID();
  const reply = await f.act(
    "c",
    {
      action: "comment",
      postId: p,
      parentId: top.commentId!,
      text: "Response",
    },
    rid,
  );
  const repeatedReply = await f.act(
    "c",
    {
      action: "comment",
      postId: p,
      parentId: top.commentId!,
      text: "Response",
    },
    rid,
  );
  assert.equal(repeatedReply.commentId, reply.commentId);
  for (const user of ["a", "b"]) {
    const notices = (await f.snap(user)).notifications.filter(
      (n) => n.commentId === reply!.commentId,
    );
    assert.equal(notices.length, 1);
    await f.act(user, {
      action: "notifications.read",
      notificationId: notices[0].id,
    });
    assert.ok(
      (await f.snap(user)).notifications.find((n) => n.id === notices[0].id)!
        .readAt,
    );
    await f.act(user, {
      action: "notifications.read",
      notificationId: notices[0].id,
      read: false,
    });
    assert.equal(
      (await f.snap(user)).notifications.find((n) => n.id === notices[0].id)!
        .readAt,
      null,
    );
  }
  assert.equal((await f.snap("c")).notifications.length, 0);
  await f.act("c", { action: "comment.delete", commentId: reply!.commentId! });
  assert.equal(
    (await f.snap("a", { post: p, comment: reply!.commentId! }))
      .commentUnavailable,
    true,
  );
  assert.equal(
    (await f.snap("a")).notifications.some(
      (n) => n.commentId === reply!.commentId,
    ),
    false,
  );
});

test("issue priorities stay private, reorder independently from support, and share selected immutable snapshots", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  await f.act("a", {
    action: "ranking",
    itemId: "homes",
    score: 8,
    note: "Private policy note",
  });
  await f.act("a", {
    action: "priority.save",
    issueId: "housing",
    note: "Private housing reason",
  });
  await f.act("a", {
    action: "priority.save",
    issueId: "transit",
    note: "Private transit reason",
  });
  await f.act("a", { action: "priority.save", issueId: "housing" });
  assert.equal(
    (await f.snap("a")).priorities[0].note,
    "Private housing reason",
  );
  await f.act("a", {
    action: "priority.order",
    issueIds: ["transit", "housing"],
  });
  assert.deepEqual(
    (await f.snap("a")).priorities.map((p) => p.issueId),
    ["transit", "housing"],
  );
  assert.equal((await f.snap("a")).rankings[0].score, 8);
  assert.deepEqual((await f.snap("b", { author: "a" })).priorities, []);
  const shared = await f.act("a", {
    action: "priority.share",
    issueIds: ["housing", "transit"],
    title: "Priorities",
    text: "",
    audience: "friends",
  });
  const before = (await f.snap("b", { post: shared.postId! })).posts[0]
    .attachmentJson;
  assert.equal(before.includes("Private"), false);
  assert.deepEqual(
    JSON.parse(before).items.map((r: { itemId: string }) => r.itemId),
    ["transit", "housing"],
  );
  await f.act("a", { action: "priority.remove", issueId: "transit" });
  assert.equal(
    (await f.snap("b", { post: shared.postId! })).posts[0].attachmentJson,
    before,
  );
  await denied(f.snap("c", { post: shared.postId! }), 404);
  await denied(
    f.act("b", {
      action: "priority.share",
      issueIds: ["housing"],
      title: "No access",
      text: "",
    }),
    400,
  );
  await denied(
    f.act("a", { action: "priority.order", issueIds: ["housing", "housing"] }),
    400,
  );
  await denied(
    f.act("a", { action: "priority.order", issueIds: ["transit", "housing"] }),
    409,
  );
  await f.act("a", { action: "onboarding.complete" });
  assert.equal((await f.snap("a")).me!.onboardingComplete, 1);
  assert.equal((await f.snap("b")).me!.onboardingComplete, 0);
});

test("beta migration upgrades existing profiles without losing activity", () => {
  const raw = new DatabaseSync(":memory:");
  const files = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files.slice(0, 2))
    raw.exec(readFileSync("drizzle/" + file, "utf8"));
  raw.exec(
    "INSERT INTO profiles(id,name,username,createdAt) VALUES('old','Existing','existing','2026-09-01'); INSERT INTO saves(userId,targetId) VALUES('old','library-forum');",
  );
  for (const file of files.slice(2))
    raw.exec(readFileSync("drizzle/" + file, "utf8"));
  assert.equal(
    raw.prepare("SELECT onboardingComplete FROM profiles WHERE id='old'").get()!
      .onboardingComplete,
    0,
  );
  assert.equal(
    raw.prepare("SELECT COUNT(*) n FROM saves WHERE userId='old'").get()!.n,
    1,
  );
  raw.close();
});

// Dated event coverage uses synthetic records only; the migration and service are real.
import type { CommunityEvent } from "../lib/social/types.ts";
const futureEvent = (id = "fixture-garden-date"): CommunityEvent => ({
  id,
  seriesId: "fixture-garden",
  title: "SYNTHETIC garden tour",
  description: "A synthetic event used only to verify privacy.",
  organizer: "Test organizer",
  sourceUrl: "https://example.test/event",
  checkedAt: "2026-01-01T00:00:00.000Z",
  venue: "Test venue",
  address: "Test address",
  city: "Ithaca",
  latitude: 42.4,
  longitude: -76.5,
  imageUrl: "",
  startsAt: "2099-09-20T14:00:00.000Z",
  endsAt: "2099-09-20T15:00:00.000Z",
  timezone: "America/New_York",
  category: "outdoors",
  cost: "unknown",
  costDetails: "",
  accessibility: "",
  registration: "Organizer signup required",
  registrationUrl: "https://example.test/register",
  issueId: "",
  status: "published",
  sample: true,
});

test("dated event saves and private attendance persist, deduplicate, and never expose names or counts to other members", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const event = futureEvent();
  await f.act("owner", { action: "event.save", event });
  const request = crypto.randomUUID();
  const plan = {
    action: "plan",
    eventId: event.id,
    status: "attending",
    audience: "only_me",
  } as const;
  await f.act("a", plan, request);
  await f.act("a", plan, request);
  await f.act("a", plan);
  assert.equal(f.count("plans"), 1);
  assert.equal(f.count("posts"), 0);
  assert.equal((await f.snap("a")).plans[0].status, "attending");
  for (const id of ["b", "c"]) assert.equal((await f.snap(id)).plans.length, 0);
  const save = { action: "save", targetId: event.id, enabled: true } as const;
  await f.act("a", save);
  await f.act("a", save);
  assert.equal(f.count("saves"), 1);
  assert.deepEqual((await f.snap("a")).saved, [event.id]);
  assert.equal((await f.snap("b")).saved.length, 0);
  await denied(
    f.service("b").execute({
      requestId: crypto.randomUUID(),
      data: { ...plan, userId: "a" },
    }),
    400,
  );
  assert.equal((await f.snap(null)).events.length, 0);
  const metrics = f.raw
    .prepare("SELECT userId,objectId FROM metrics WHERE event LIKE 'event_%'")
    .all();
  assert.ok(
    metrics.every((x) => x.userId === "aggregate" && x.objectId === null),
  );
});

test("event privacy changes revoke prior discussions, honor friends, mutes and blocks, and preserve explicit sharing", async () => {
  const f = fixture();
  await f.setup();
  await f.friends();
  const e = futureEvent();
  await f.act("owner", { action: "event.save", event: e });
  await f.act("a", {
    action: "plan",
    eventId: e.id,
    status: "interested",
    audience: "friends",
  });
  const p = (await f.snap("b", { event: e.id })).posts[0];
  assert.equal(p.subjectId, e.id);
  assert.equal((await f.snap("b")).plans.length, 1);
  assert.equal((await f.snap("c")).plans.length, 0);
  const reply = await f.act("b", {
    action: "comment",
    postId: p.id,
    text: "SYNTHETIC question",
  });
  assert.ok(
    (await f.snap("a")).notifications.some(
      (n) => n.commentId === reply.commentId,
    ),
  );
  await f.act("a", {
    action: "plan",
    eventId: e.id,
    status: "interested",
    audience: "only_me",
  });
  await denied(f.snap("b", { post: p.id }), 404);
  assert.equal((await f.snap("b")).plans.length, 0);
  await f.act("a", {
    action: "plan",
    eventId: e.id,
    status: "interested",
    audience: "community",
  });
  assert.equal((await f.snap("c")).plans.length, 1);
  await f.act("b", { action: "mute", targetId: "a", enabled: true });
  assert.equal((await f.snap("b")).plans.length, 0);
  await f.act("c", { action: "block", targetId: "a", enabled: true });
  assert.equal((await f.snap("c")).plans.length, 0);
  await f.act("a", { action: "plan", eventId: e.id, status: null });
  assert.equal(f.count("plans"), 0);
});

test("curation permissions, seed retries, private preferences and suggestion review are enforced", async () => {
  const f = fixture();
  await f.setup();
  const event = futureEvent();
  await denied(f.act("a", { action: "event.save", event }), 403);
  await f.act("owner", { action: "event.save", event, createOnly: true });
  await f.act("owner", {
    action: "event.save",
    event: { ...event, title: "Curator corrected title" },
  });
  await f.act("owner", { action: "event.save", event, createOnly: true });
  assert.equal(f.count("community_events"), 1);
  assert.equal((await f.snap("a")).events[0].title, "Curator corrected title");
  await f.act("a", {
    action: "event.preferences",
    city: "Ithaca",
    interests: ["outdoors"],
  });
  assert.deepEqual((await f.snap("a")).eventPreferences.interests, [
    "outdoors",
  ]);
  assert.deepEqual((await f.snap("b")).eventPreferences.interests, []);
  const request = crypto.randomUUID(),
    suggest = {
      action: "event.suggest",
      title: "Test suggestion",
      sourceUrl: "https://example.test/event",
      note: "SYNTHETIC review note",
    } as const;
  await f.act("a", suggest, request);
  await f.act("a", suggest, request);
  assert.equal(f.count("event_suggestions"), 1);
  assert.equal((await f.snap("b")).eventSuggestions?.length, 0);
  const suggestionId = (await f.snap("owner")).eventSuggestions![0].id;
  await denied(
    f.act("a", { action: "event.review", suggestionId, status: "reviewed" }),
    403,
  );
  await f.act("owner", {
    action: "event.review",
    suggestionId,
    status: "reviewed",
  });
  assert.equal((await f.snap("a")).eventSuggestions![0].status, "reviewed");
});

test("withdrawal hides event discussions and notifications; cancel keeps informative links but rejects new intent", async () => {
  const f = fixture();
  await f.setup();
  const event = futureEvent();
  await f.act("owner", { action: "event.save", event });
  const p = await f.act("a", {
    action: "post",
    kind: "question",
    subjectId: event.id,
    text: "SYNTHETIC event discussion",
    audience: "community",
  });
  await f.act("b", {
    action: "comment",
    postId: p.postId as string,
    text: "SYNTHETIC reply",
  });
  await f.act("owner", {
    action: "event.status",
    eventId: event.id,
    status: "draft",
  });
  assert.equal((await f.snap("a")).events.length, 0);
  assert.equal((await f.snap("a")).notifications.length, 0);
  await denied(f.snap("a", { post: p.postId as string }), 404);
  await denied(
    f.act("a", { action: "save", targetId: event.id, enabled: true }),
    404,
  );
  await f.act("owner", {
    action: "event.status",
    eventId: event.id,
    status: "published",
  });
  await f.act("a", { action: "plan", eventId: event.id, status: "attending" });
  await f.act("owner", {
    action: "event.status",
    eventId: event.id,
    status: "canceled",
  });
  assert.equal((await f.snap("a")).events[0].status, "canceled");
  await denied(
    f.act("b", { action: "plan", eventId: event.id, status: "interested" }),
    409,
  );
  await f.act("a", {
    action: "plan",
    eventId: event.id,
    status: "attending",
    audience: "community",
  });
  assert.equal((await f.snap("b")).plans.length, 1);
  await f.act("a", {
    action: "plan",
    eventId: event.id,
    status: "attending",
    audience: "only_me",
  });
  assert.equal((await f.snap("b")).plans.length, 0);
  await f.act("a", { action: "plan", eventId: event.id, status: null });
  assert.equal(f.count("plans"), 0);
});

test("in-flight event RSVP rolls back when a curator cancels the occurrence", async () => {
  const f = fixture();
  await f.setup();
  const event = futureEvent();
  await f.act("owner", { action: "event.save", event });
  f.hooks.batch = async () => {
    f.hooks.batch = null;
    await f.act("owner", {
      action: "event.status",
      eventId: event.id,
      status: "canceled",
    });
  };
  await denied(
    f.act("a", {
      action: "plan",
      eventId: event.id,
      status: "attending",
      audience: "community",
    }),
    409,
  );
  assert.equal(f.count("plans"), 0);
  assert.equal(f.count("posts"), 0);
});

test("one series occurrence cannot be duplicated under another ID and curator authority is checked at commit", async () => {
  const f = fixture();
  await f.setup();
  const event = futureEvent();
  await f.act("owner", { action: "event.save", event });
  await denied(
    f.act("owner", {
      action: "event.save",
      event: { ...event, id: "duplicate-other-id" },
    }),
    409,
  );
  assert.equal(f.count("community_events"), 1);
  f.raw.exec("UPDATE memberships SET role='curator' WHERE userId='a'");
  f.hooks.batch = async () => {
    f.hooks.batch = null;
    f.raw.exec("UPDATE memberships SET role='member' WHERE userId='a'");
  };
  await denied(
    f.act("a", {
      action: "event.status",
      eventId: event.id,
      status: "canceled",
    }),
    409,
  );
  assert.equal((await f.snap("b")).events[0].status, "published");
});

test("shared codes admit different emails up to their limit and retries consume one use", async () => {
  const f = fixture(); await f.setup();
  const key = crypto.randomUUID();
  const data = { action: "invite.code", maxUses: 2, expiresDays: 7 } as const;
  const code = await f.act("owner", data, key);
  assert.deepEqual(await f.act("owner", data, key), code);
  assert.match(code.invitationCode as string, /^POLIS-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  const command = { requestId: crypto.randomUUID(), data: { action: "join", confirmedCommunityId: "ithaca", name: "First", username: "first_code", invite: String(code.invitationCode).toLowerCase().replaceAll("-", " ") } };
  await f.service("first").execute(command);
  await f.service("first").execute(command);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 1);
  await f.act("second", { action: "join", confirmedCommunityId: "ithaca", name: "Second", username: "second_code", invite: code.invitationCode as string });
  await denied(f.act("third", { action: "join", confirmedCommunityId: "ithaca", name: "Third", username: "third_code", invite: code.invitationCode as string }), 403);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 2);
  assert.equal((await f.snap("first")).me?.role, "member");
  assert.equal((await f.snap("first")).admin, undefined);
  const rows = (await f.snap("owner")).admin!.invitationCodes;
  assert.equal(rows.length, 1);
  assert.equal("tokenHash" in rows[0], false);
  assert.equal(JSON.stringify(rows).includes(String(code.invitationCode)), false);
  f.raw.close();
});

test("only owner can create/revoke codes; invalid, expired and revoked codes cannot join", async () => {
  const f = fixture(); await f.setup();
  await denied(f.act("a", { action: "invite.code", maxUses: 25, expiresDays: 7 }), 403);
  await denied(f.act("owner", { action: "invite.code", maxUses: 10001, expiresDays: 7 }), 400);
  const code = await f.act("owner", { action: "invite.code", maxUses: 25, expiresDays: 1 });
  const id = (await f.snap("owner")).admin!.invitationCodes[0].id;
  await denied(f.act("a", { action: "invite.revoke", codeId: id }), 403);
  const join = { action: "join", confirmedCommunityId: "ithaca", name: "New", username: "new_code", invite: code.invitationCode as string } as const;
  await denied(f.act("new", { ...join, invite: "POLIS-INVALID" }), 403);
  f.raw.prepare("UPDATE invitation_codes SET expiresAt=? WHERE id=?").run("2000-01-01T00:00:00.000Z", id);
  await denied(f.act("new", join), 403);
  f.raw.prepare("UPDATE invitation_codes SET expiresAt=? WHERE id=?").run("2099-01-01T00:00:00.000Z", id);
  await f.act("owner", { action: "invite.revoke", codeId: id });
  await denied(f.act("new", join), 403);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 0);
  assert.equal(f.raw.prepare("SELECT id FROM profiles WHERE id='new'").get(), undefined);
  f.raw.close();
});

test("last code use and revocation are checked transactionally before profile creation", async () => {
  for (const revoke of [false, true]) {
    const f = fixture(); await f.setup();
    const code = await f.act("owner", { action: "invite.code", maxUses: 1, expiresDays: 7 });
    const id = (await f.snap("owner")).admin!.invitationCodes[0].id;
    const gate = pauseOnce(f, "INSERT INTO profiles");
    const first = f.act("first", { action: "join", confirmedCommunityId: "ithaca", name: "First", username: "first_code", invite: code.invitationCode as string });
    await gate.atGate;
    if (revoke) await f.act("owner", { action: "invite.revoke", codeId: id });
    else await f.act("second", { action: "join", confirmedCommunityId: "ithaca", name: "Second", username: "second_code", invite: code.invitationCode as string });
    gate.release(); await denied(first, 409);
    assert.equal(f.raw.prepare("SELECT id FROM profiles WHERE id='first'").get(), undefined);
    assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, revoke ? 0 : 1);
    f.raw.close();
  }
});

test("preview reveals only the configured community; confirmation and normal authentication remain mandatory", async () => {
  const f = fixture(); await f.setup();
  const { invitationCode } = await f.act("owner", { action: "invite.code", communityId: "emory", maxUses: null });
  const preview = await f.service(null).previewInvitation(invitationCode);
  assert.deepEqual(Object.keys(preview).sort(), ["alreadyJoined", "community", "expiresAt"]);
  assert.equal(preview.community.id, "emory");
  assert.equal(preview.alreadyJoined, false);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 0);
  const join = { action: "invite.redeem", invite: invitationCode as string, confirmedCommunityId: "emory", name: "New", username: "new_person" } as const;
  await denied(f.service(null).execute({ requestId: crypto.randomUUID(), data: join }), 401);
  await denied(f.act("new", { ...join, confirmedCommunityId: "ithaca" }), 400);
  await denied(f.service("new").execute({ requestId: crypto.randomUUID(), data: { ...join, role: "owner" } }), 400);
  await f.act("new", join);
  const snap = await f.snap("new");
  assert.equal(snap.me?.role, "member");
  assert.equal(snap.community?.id, "emory");
  assert.equal(snap.admin, undefined);
  assert.equal(snap.events.length, 0);
  assert.equal(snap.question, null);
  assert.equal((await f.service("new").previewInvitation(invitationCode)).alreadyJoined, true);
  f.raw.close();
});

test("joining a second community preserves the profile, original membership and private data", async () => {
  const f = fixture(); await f.setup();
  await f.act("a", { action: "save", targetId: "homes", enabled: true });
  const prior = (await f.snap("a")).me;
  const { invitationCode } = await f.act("owner", { action: "invite.code", communityId: "emory", maxUses: null });
  const join = { action: "invite.redeem", invite: invitationCode as string, confirmedCommunityId: "emory" } as const;
  await f.act("a", join);
  await f.act("a", join);
  await f.act("b", join);
  const a = await f.snap("a");
  assert.equal(a.me?.username, prior?.username);
  assert.deepEqual(a.communities.map(c => c.id).sort(), ["emory", "ithaca"]);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 2);
  assert.equal(f.count("invitation_redemptions"), 2);
  const other = await f.act("owner", { action: "invite.code", communityId: "emory", maxUses: 1 });
  await f.act("a", { ...join, invite: other.invitationCode as string });
  assert.equal(f.raw.prepare("SELECT SUM(useCount) n FROM invitation_codes").get()!.n, 2);
  await f.act("a", { action: "community.select", communityId: "ithaca" });
  assert.ok((await f.snap("a")).saved.includes("homes"));
  await denied(f.act("c", { action: "community.select", communityId: "emory" }), 403);
  // Even the configured owner receives ordinary membership when redeeming a code.
  await f.act("owner", join);
  assert.equal((await f.snap("owner")).me?.role, "member");
  assert.equal((await f.snap("owner", { community: "ithaca" })).me?.role, "owner");
  f.raw.close();
});

test("fresh request IDs and simultaneous redemption do not consume another slot for one identity", async () => {
  const f = fixture(); await f.setup();
  const { invitationCode } = await f.act("owner", { action: "invite.code", communityId: "emory", maxUses: 1 });
  const data = { action: "invite.redeem", invite: invitationCode as string, confirmedCommunityId: "emory", name: "New", username: "concurrent_person" } as const;
  const gate = pauseOnce(f, "INSERT INTO profiles");
  const first = f.act("new", data);
  await gate.atGate;
  await f.act("new", data);
  gate.release();
  await first;
  await f.act("new", data);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 1);
  assert.equal(f.count("invitation_redemptions"), 1);
  assert.equal(f.raw.prepare("SELECT COUNT(*) n FROM pilot_memberships WHERE userId='new'").get()!.n, 1);
  await denied(f.act("different", { ...data, username: "different_person" }), 403);
  f.raw.close();
});

test("expiration at transaction time and profile errors roll back admission and counts", async () => {
  const f = fixture(); await f.setup();
  const { invitationCode } = await f.act("owner", { action: "invite.code", communityId: "emory", maxUses: null });
  const data = { action: "invite.redeem", invite: invitationCode as string, confirmedCommunityId: "emory", name: "New", username: "person_a" } as const;
  await denied(f.act("new", data), 409);
  assert.equal(f.count("invitation_redemptions"), 0);
  const gate = pauseOnce(f, "INSERT INTO profiles");
  const pending = f.act("new", { ...data, username: "expires_during_join" });
  await gate.atGate;
  f.raw.prepare("UPDATE invitation_codes SET expiresAt=?").run(new Date(Date.now() + 25).toISOString());
  await new Promise(r => setTimeout(r, 50));
  gate.release();
  await denied(pending, 409);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 0);
  assert.equal(f.raw.prepare("SELECT id FROM profiles WHERE id='new'").get(), undefined);
  assert.equal(f.count("invitation_redemptions"), 0);
  f.raw.close();
});

test("communities isolate direct reads, posts, administration, feedback and legacy invitation authority", async () => {
  const f = fixture(); await f.setup();
  const cornellPost = await f.post("community");
  const { invitationCode } = await f.act("owner", { action: "invite.code", communityId: "emory", maxUses: null });
  for (const u of ["a", "b"]) await f.act(u, { action: "invite.redeem", invite: invitationCode as string, confirmedCommunityId: "emory" });
  const emoryPost = await f.act("a", { action: "post", kind: "question", subjectId: "community", text: "Where should we volunteer?", audience: "community" });
  assert.ok((await f.snap("b", { filter: "community" })).posts.some(p => p.id === emoryPost.postId));
  assert.equal((await f.snap("b")).posts.some(p => p.id === cornellPost), false);
  await denied(f.snap("c", { community: "emory" }), 403);
  await denied(f.snap("c", { post: emoryPost.postId as string }), 404);
  await denied(f.act("c", { action: "reaction", postId: emoryPost.postId as string, kind: "agree" }), 404);
  await f.act("a", { action: "report", targetId: emoryPost.postId as string, reason: "Synthetic moderation review" });
  assert.equal((await f.snap("owner")).admin!.reports.length, 0);
  f.raw.exec("UPDATE community_memberships SET role='owner' WHERE userId='b' AND communityId='emory'");
  const scoped = await f.snap("b");
  assert.deepEqual(scoped.admin!.invitationCommunities.map(c => c.id), ["emory"]);
  assert.equal(scoped.admin!.reports.length, 1);
  await denied(f.act("b", { action: "invite.code", communityId: "ithaca", maxUses: 3 }), 403);
  await denied(f.act("b", { action: "invite", email: "someone@example.test" }), 400);
  await denied(f.act("b", { action: "save", targetId: "homes", enabled: true }), 404);
  const ownCode = await f.act("b", { action: "invite.code", maxUses: 3 });
  assert.equal((await f.service(null).previewInvitation(ownCode.invitationCode)).community.id, "emory");
  const cornellCode = await f.act("owner", { action: "invite.code" });
  const cornellId = f.raw.prepare("SELECT id FROM invitation_codes WHERE communityId='ithaca'").get()!.id as string;
  await denied(f.act("b", { action: "invite.revoke", codeId: cornellId }), 404);
  assert.ok(cornellCode.invitationCode);
  f.raw.close();
});

test("invitation migrations preserve existing memberships and code use counts without rewriting legacy tables", () => {
  const raw = new DatabaseSync(":memory:");
  const migrations = readdirSync("drizzle").filter(n => n.endsWith(".sql")).sort();
  for (const file of migrations.filter(n => n < "0005")) raw.exec(readFileSync("drizzle/" + file, "utf8"));
  raw.exec("INSERT INTO profiles(id,name,username,createdAt) VALUES('old','Existing','existing','2026-01-01'); INSERT INTO memberships(userId,communityId,role) VALUES('old','ithaca','owner'); INSERT INTO invitation_codes(id,tokenHash,createdBy,createdAt,expiresAt,maxUses,useCount) VALUES('legacy-code','opaque-hash','old','2026-01-01','2027-01-01',25,7); INSERT INTO saves(userId,targetId) VALUES('old','homes');");
  for (const file of migrations.filter(n => n >= "0005")) raw.exec(readFileSync("drizzle/" + file, "utf8"));
  assert.equal(raw.prepare("SELECT role FROM pilot_memberships WHERE userId='old'").get()!.role, "owner");
  assert.equal(raw.prepare("SELECT activeCommunityId FROM profiles WHERE id='old'").get()!.activeCommunityId, "ithaca");
  assert.equal(raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 7);
  assert.equal(raw.prepare("SELECT communityId FROM invitation_codes").get()!.communityId, "ithaca");
  assert.equal(raw.prepare("SELECT organizationId FROM invitation_codes").get()!.organizationId, null);
  assert.equal(raw.prepare("SELECT COUNT(*) n FROM saves").get()!.n, 1);
  raw.close();
});

test("cross-community event ID races cannot overwrite a listing or hide generic conversations", async () => {
  const f = fixture(); await f.setup();
  const { invitationCode } = await f.act("owner", { action: "invite.code", communityId: "emory" });
  await f.act("a", { action: "invite.redeem", invite: invitationCode as string, confirmedCommunityId: "emory" });
  f.raw.exec("UPDATE community_memberships SET role='owner' WHERE userId='a' AND communityId='emory'");
  const event = futureEvent("shared-id");
  const gate = pauseOnce(f, "INSERT INTO community_events");
  const pending = f.act("a", { action: "event.save", event: { ...event, title: "Emory title" } });
  await gate.atGate;
  await f.act("owner", { action: "event.save", event });
  gate.release(); await denied(pending, 409);
  assert.equal((await f.snap("owner")).events.find(e => e.id === event.id)?.title, event.title);
  await denied(f.act("a", { action: "event.save", event: { ...event, id: "community", status: "draft" } }), 400);
  f.raw.close();
});
