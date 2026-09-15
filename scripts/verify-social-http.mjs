import assert from "node:assert/strict";
// Writes synthetic records only. Run in an isolated checkout with local D1,
// POLIS_TEST_ACCOUNTS=1 and the example development owner. Never use hosted URLs.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5175";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const cookies = {};
for (const [user, account] of [
  ["a", "1"],
  ["b", "beta_b"],
  ["c", "beta_c"],
]) {
  const r = await fetch(
    origin + "/signin-with-chatgpt?test_account=" + account,
    { redirect: "manual" },
  );
  assert.equal(r.status, 302);
  cookies[user] = r.headers.get("set-cookie").split(";")[0];
}
async function snapshot(user, params = {}) {
  const r = await fetch(origin + "/api/polis?" + new URLSearchParams(params), {
    headers: { Cookie: cookies[user] },
  });
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  return body;
}
async function act(
  user,
  data,
  expected = 200,
  requestId = crypto.randomUUID(),
) {
  const r = await fetch(origin + "/api/polis", {
    method: "POST",
    headers: {
      Cookie: cookies[user],
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId, data }),
  });
  const body = await r.json();
  assert.equal(r.status, expected, JSON.stringify(body));
  return body;
}
let a = await snapshot("a"),
  b = await snapshot("b"),
  c = await snapshot("c");
assert.equal(
  new Set([a.me?.id, b.me?.id, c.me?.id]).size,
  3,
  "Start with POLIS_TEST_ACCOUNTS=1; test identities must be isolated.",
);
if (a.status === "onboarding")
  await act("a", { action: "join", name: "Beta Alex", username: "beta_alex" });
for (const [user, name] of [
  ["b", "Beta Blair"],
  ["c", "Beta Casey"],
]) {
  if ((await snapshot(user)).status === "onboarding") {
    const inv = await act("a", {
      action: "invite",
      email: `beta_${user}@sites.test`,
    });
    await act(user, {
      action: "join",
      name,
      username: `beta_${user}`,
      invite: inv.invite,
    });
  }
}
a = await snapshot("a");
b = await snapshot("b");
c = await snapshot("c");
for (const u of ["a", "b"]) {
  const targetId = u === "a" ? b.me.id : a.me.id;
  await act(u, { action: "block", targetId, enabled: false });
  await act(u, { action: "mute", targetId, enabled: false });
}
await act("a", { action: "friend", targetId: b.me.id, operation: "remove" });
const request = crypto.randomUUID();
await act(
  "a",
  { action: "friend", targetId: b.me.id, operation: "request" },
  200,
  request,
);
await act(
  "a",
  { action: "friend", targetId: b.me.id, operation: "request" },
  200,
  request,
);
assert.equal(
  (await snapshot("b")).notifications.filter((n) => n.kind === "friend_request")
    .length,
  1,
);
await act("b", { action: "friend", targetId: a.me.id, operation: "accept" });
const postData = {
  action: "post",
  kind: "opinion",
  subjectId: "transit",
  text: "SYNTHETIC TEST: Reliable buses would make my everyday trips easier.",
  position: "support",
  sourceUrl: "https://tcatbus.com/",
  audience: "friends",
};
const pid = crypto.randomUUID();
const post = await act("b", postData, 200, pid);
assert.equal((await act("b", postData, 200, pid)).postId, post.postId);
const p = post.postId;
assert.ok((await snapshot("a")).posts.some((row) => row.id === p));
assert.equal(
  (await snapshot("c", { filter: "all" })).posts.some((row) => row.id === p),
  false,
);
const direct = await fetch(origin + "/api/polis?post=" + p, {
  headers: { Cookie: cookies.c },
});
assert.equal(direct.status, 404);
await act("a", { action: "post.edit", postId: p, text: "Unauthorized" }, 403);
for (const kind of ["agree", "thoughtful", null]) {
  await act("a", { action: "reaction", postId: p, kind });
  const row = (await snapshot("b", { post: p })).posts[0];
  assert.equal(
    row.reactions.reduce((sum, r) => sum + r.count, 0),
    kind ? 1 : 0,
  );
}
const comment = await act("a", {
  action: "comment",
  postId: p,
  text: "SYNTHETIC TEST: Would evening service help most?",
});
let notice = (await snapshot("b")).notifications.find(
  (n) => n.commentId === comment.commentId,
);
assert.ok(notice && !notice.readAt);
await act("b", { action: "notifications.read", notificationId: notice.id });
assert.ok(
  (await snapshot("b")).notifications.find((n) => n.id === notice.id).readAt,
);
await act("b", {
  action: "notifications.read",
  notificationId: notice.id,
  read: false,
});
assert.equal(
  (await snapshot("b")).notifications.find((n) => n.id === notice.id).readAt,
  null,
);
const reply = await act("b", {
  action: "comment",
  postId: p,
  parentId: comment.commentId,
  text: "SYNTHETIC TEST: Yes, especially for late shifts.",
});
notice = (await snapshot("a")).notifications.find(
  (n) => n.commentId === reply.commentId,
);
assert.ok(notice);
assert.ok(
  (await snapshot("a", { post: p, comment: notice.commentId })).comments.some(
    (r) => r.id === reply.commentId,
  ),
);
await act("b", {
  action: "post.edit",
  postId: p,
  text: postData.text + " Evening service matters too.",
  position: "mixed",
  sourceUrl: "https://tcatbus.com/",
});
assert.equal((await snapshot("a", { post: p })).posts[0].position, "mixed");
await act("a", { action: "save", targetId: "library-forum", enabled: true });
assert.ok((await snapshot("a")).saved.includes("library-forum"));
assert.equal((await snapshot("b")).saved.includes("library-forum"), false);
await act("a", { action: "mute", targetId: b.me.id, enabled: true });
assert.equal(
  (await snapshot("a")).posts.some((r) => r.id === p),
  false,
);
assert.equal(
  (await snapshot("a")).notifications.some(
    (n) => n.commentId === reply.commentId,
  ),
  false,
);
await act("a", { action: "mute", targetId: b.me.id, enabled: false });
await act("a", { action: "comment.delete", commentId: comment.commentId });
assert.equal(
  (await snapshot("b", { post: p, comment: comment.commentId }))
    .commentUnavailable,
  true,
);
await act("a", { action: "block", targetId: b.me.id, enabled: true });
assert.equal(
  (await snapshot("b")).people.some((r) => r.id === a.me.id),
  false,
);
await act("b", { action: "post.delete", postId: p });
await act("a", { action: "block", targetId: b.me.id, enabled: false });
await act("a", { action: "friend", targetId: b.me.id, operation: "request" });
await act("b", { action: "friend", targetId: a.me.id, operation: "accept" });
// A clearly fictional review conversation remains for browser verification.
const sample = await act("b", {
  ...postData,
  text: "SYNTHETIC TEST · I’d prioritize reliable evening buses. Which trips would better service make possible for you?",
});
await act("a", {
  action: "comment",
  postId: sample.postId,
  text: "SYNTHETIC TEST · Getting home after an evening library shift, especially in winter.",
});
console.log(
  "PASS local Worker HTTP: three isolated synthetic sessions, invitations, friendship retries, feed, private direct-link denial, ownership, reactions, reply notifications and exact links, read/unread, edits, private saves, mute, block, deletion. Hosted ChatGPT identities remain unverified.",
);
