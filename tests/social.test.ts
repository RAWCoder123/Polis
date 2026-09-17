import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  socialService,
  type Database,
  type CommandData,
} from "../lib/social/service.ts";

// Real migration SQL and service code; only the D1 transport is adapted to SQLite.
function fixture() {
  const raw = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    raw.exec(readFileSync("drizzle/" + file, "utf8"));
  type Statement = { sql: string; args: SQLInputValue[] };
  const hooks: { batch: null | ((rows: Statement[]) => Promise<void>) } = {
    batch: null,
  };
  const adapter = {
    prepare(sql: string) {
      return {
        bind(...args: SQLInputValue[]) {
          return {
            sql,
            args,
            async first() {
              return raw.prepare(sql).get(...args) ?? null;
            },
            async all() {
              return { results: raw.prepare(sql).all(...args) };
            },
          };
        },
      };
    },
    async batch(rows: Statement[]) {
      if (hooks.batch) await hooks.batch(rows);
      raw.exec("BEGIN");
      try {
        const results = rows.map((s) => ({
          success: true,
          meta: { changes: raw.prepare(s.sql).run(...s.args).changes },
        }));
        raw.exec("COMMIT");
        return results;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const db = adapter as unknown as Database;
  const service = (id: string | null, email = id + "@example.test") =>
    socialService(
      db,
      id ? { userId: id, email, displayName: id } : null,
      "owner@example.test",
    );
  const act = (
    id: string,
    data: CommandData,
    requestId = crypto.randomUUID(),
  ) => service(id).execute({ requestId, data });
  const snap = (id: string | null, params: Record<string, string> = {}) =>
    service(id).snapshot(new URLSearchParams(params));
  const count = (table: string) =>
    Number(raw.prepare("SELECT COUNT(*) n FROM " + table).get()!.n);
  async function setup() {
    await act("owner", { action: "join", name: "Owner", username: "owner" });
    for (const id of ["a", "b", "c"]) {
      const inv = await act("owner", {
        action: "invite",
        email: id + "@example.test",
      });
      await act(id, {
        action: "join",
        name: "Person " + id,
        username: "person_" + id,
        invite: inv.invite,
      });
    }
  }
  async function friends() {
    await act("a", { action: "friend", targetId: "b", operation: "request" });
    await act("b", { action: "friend", targetId: "a", operation: "accept" });
  }
  async function post(
    audience: "friends" | "community" | "only_me" = "friends",
  ) {
    return (
      await act("a", {
        action: "post",
        kind: "opinion",
        subjectId: "homes",
        text: "Test contribution",
        audience,
      })
    ).postId as string;
  }
  return { raw, hooks, service, act, snap, count, setup, friends, post };
}
const denied = (p: Promise<unknown>, status: number) =>
  assert.rejects(p, (e: { status?: number }) => e.status === status);

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
  const command = { requestId: crypto.randomUUID(), data: { action: "join", name: "First", username: "first_code", invite: String(code.invitationCode).toLowerCase().replaceAll("-", " ") } };
  await f.service("first").execute(command);
  await f.service("first").execute(command);
  assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, 1);
  await f.act("second", { action: "join", name: "Second", username: "second_code", invite: code.invitationCode as string });
  await denied(f.act("third", { action: "join", name: "Third", username: "third_code", invite: code.invitationCode as string }), 403);
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
  await denied(f.act("owner", { action: "invite.code", maxUses: 101, expiresDays: 7 }), 400);
  const code = await f.act("owner", { action: "invite.code", maxUses: 25, expiresDays: 1 });
  const id = (await f.snap("owner")).admin!.invitationCodes[0].id;
  await denied(f.act("a", { action: "invite.revoke", codeId: id }), 403);
  const join = { action: "join", name: "New", username: "new_code", invite: code.invitationCode as string } as const;
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
    const first = f.act("first", { action: "join", name: "First", username: "first_code", invite: code.invitationCode as string });
    await gate.atGate;
    if (revoke) await f.act("owner", { action: "invite.revoke", codeId: id });
    else await f.act("second", { action: "join", name: "Second", username: "second_code", invite: code.invitationCode as string });
    gate.release(); await denied(first, 409);
    assert.equal(f.raw.prepare("SELECT id FROM profiles WHERE id='first'").get(), undefined);
    assert.equal(f.raw.prepare("SELECT useCount FROM invitation_codes").get()!.useCount, revoke ? 0 : 1);
    f.raw.close();
  }
});
