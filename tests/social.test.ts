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
  for (const itemId of ["constructor", "__proto__", "toString", "unknown-item"]) {
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
      400,
    );
  }
  assert.equal(f.count("saves"), 0);
  assert.equal(f.count("rankings"), 0);

  // Older unsupported records must not poison the profile or saved-items response.
  f.raw.exec("INSERT INTO saves(userId,targetId) VALUES('a','constructor')");
  f.raw.exec(
    "INSERT INTO rankings(userId,itemId,score,note,priority) VALUES('a','constructor',5,'',0)",
  );
  await f.act("a", { action: "save", targetId: "housing-meeting", enabled: true });
  await f.act("a", { action: "ranking", itemId: "homes", score: 7, note: "" });
  const snapshot = await f.snap("a");
  assert.deepEqual(snapshot.saved, ["housing-meeting"]);
  assert.deepEqual(snapshot.rankings.map((r) => r.itemId), ["homes"]);
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
