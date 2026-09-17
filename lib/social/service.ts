import { z } from "zod";
import { itemById } from "../polis-data.ts";
import { eventActions, eventExpired } from "./events.ts";
import { communityId, issues, issueFor, eventStart } from "./catalog.ts";
import {
  emptySnapshot,
  type Snapshot,
  type Person,
  type Post,
  type Question,
  type CommunityEvent,
} from "./types.ts";
export type Identity = { userId: string; email: string; displayName: string };
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const fail = (status: number, message: string): never => {
  throw new ApiError(status, message);
};
const catalogItem = (itemId: string) =>
  Object.hasOwn(itemById, itemId) ? itemById[itemId] : undefined;
const id = z.string().min(1).max(180);
const audience = z.enum(["only_me", "friends", "community"]);
const position = z.enum([
  "support",
  "reservations",
  "mixed",
  "oppose",
  "learning",
]);
const text = z.string().trim().max(3000);
const source = z
  .string()
  .max(2000)
  .url()
  .refine((s) => {
    try {
      const url = new URL(s);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS link without embedded credentials.");
const action = z.discriminatedUnion("action", [
  ...eventActions,
  z.object({
    action: z.literal("join"),
    name: z.string().trim().min(1).max(50),
    username: z.string().regex(/^[a-z0-9_]{3,24}$/),
    invite: z.string().max(200).default(""),
  }),
  z.object({
    action: z.literal("profile"),
    name: z.string().trim().min(1).max(50),
    bio: z.string().trim().max(300),
    communityLabel: z.string().trim().max(80),
  }),
  z.object({
    action: z.literal("friend"),
    targetId: id,
    operation: z.enum(["request", "accept", "remove"]),
  }),
  z.object({ action: z.literal("block"), targetId: id, enabled: z.boolean() }),
  z.object({ action: z.literal("mute"), targetId: id, enabled: z.boolean() }),
  z.object({
    action: z.literal("post"),
    kind: z.enum([
      "opinion",
      "question",
      "article",
      "event_reflection",
      "event_share",
    ]),
    sourceUrl: z.union([source, z.literal("")]).default(""),
    subjectId: id,
    text,
    position: position.nullable().default(null),
    audience: audience.default("friends"),
    priorPostId: id.nullable().default(null),
  }),
  z.object({
    action: z.literal("post.edit"),
    sourceUrl: z.union([source, z.literal("")]).optional(),
    postId: id,
    text,
    position: position.nullable().default(null),
  }),
  z.object({ action: z.literal("post.delete"), postId: id }),
  z.object({
    action: z.literal("reaction"),
    postId: id,
    kind: z.enum(["agree", "thoughtful", "curious"]).nullable(),
  }),
  z.object({
    action: z.literal("comment"),
    postId: id,
    parentId: id.nullable().default(null),
    text: text.refine((s) => s.length > 0, "Write a reply."),
  }),
  z.object({
    action: z.literal("comment.edit"),
    commentId: id,
    text: text.refine((s) => s.length > 0),
  }),
  z.object({ action: z.literal("comment.delete"), commentId: id }),
  z.object({ action: z.literal("save"), targetId: id, enabled: z.boolean() }),
  z.object({
    action: z.literal("ranking"),
    itemId: id,
    score: z.number().min(0).max(10),
    note: z.string().trim().max(1000),
    position: position.nullable().default(null),
  }),
  z.object({ action: z.literal("ranking.delete"), itemId: id }),
  z.object({
    action: z.literal("ranking.order"),
    itemIds: z.array(id).min(1).max(100),
  }),
  z.object({
    action: z.literal("ranking.share"),
    itemIds: z.array(id).min(1).max(20),
    title: z.string().trim().min(1).max(120),
    text,
    audience: audience.default("friends"),
  }),
  z.object({
    action: z.literal("follow"),
    issueId: id,
    enabled: z.boolean(),
    notify: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("plan"),
    eventId: id,
    status: z.enum(["interested", "attending"]).nullable(),
    audience: audience.default("only_me"),
  }),
  z.object({
    action: z.literal("answer"),
    questionId: id,
    choice: z.string().max(150),
    note: z.string().trim().max(1500),
    audience: audience.default("only_me"),
  }),
  z.object({
    action: z.literal("notifications.read"),
    read: z.boolean().default(true),
    notificationId: id.optional(),
    postId: id.optional(),
  }),
  z.object({
    action: z.literal("preferences"),
    replies: z.boolean(),
    reactions: z.boolean(),
    issues: z.boolean(),
    events: z.boolean(),
  }),
  z.object({
    action: z.literal("report"),
    targetId: id,
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({ action: z.literal("invite"), email: z.string().email().max(254) }),
  z.object({ action: z.literal("invite.code"), maxUses: z.number().int().min(1).max(100).default(25), expiresDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7) }),
  z.object({ action: z.literal("invite.revoke"), codeId: z.string().min(1).max(100) }),
  z.object({
    action: z.literal("question.save"),
    questionId: id.optional(),
    issueId: id,
    title: z.string().trim().min(5).max(180),
    background: z.string().trim().min(10).max(3000),
    sourceUrl: source,
    sample: z.boolean(),
    options: z.array(z.string().trim().min(1).max(150)).min(2).max(6),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    status: z.enum(["draft", "scheduled", "withdrawn"]),
  }),
  z.object({
    action: z.literal("issue.update"),
    issueId: id,
    title: z.string().trim().min(5).max(300),
    sourceUrl: source,
    sample: z.boolean(),
  }),
  z.object({
    action: z.literal("report.resolve"),
    reportId: id,
    removeContent: z.boolean(),
  }),
  z.object({ action: z.literal("onboarding.complete") }),
  z.object({
    action: z.literal("priority.save"),
    issueId: id,
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("priority.remove"), issueId: id }),
  z.object({
    action: z.literal("priority.order"),
    issueIds: z.array(id).min(1).max(100),
  }),
  z.object({
    action: z.literal("priority.share"),
    issueIds: z.array(id).min(1).max(20),
    title: z.string().trim().min(1).max(120),
    text,
    audience: audience.default("friends"),
    includeNotes: z.boolean().default(false),
  }),
  z.object({ action: z.literal("visit") }),
]);
const command = z
  .object({ requestId: z.string().uuid(), data: action })
  .strict();
export type CommandData = z.input<typeof action>;
export type Database = Pick<D1Database, "prepare" | "batch">;
export const digest = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
export function socialService(
  db: Database,
  identity: Identity | null,
  ownerEmail = "",
) {
  const uid = identity?.userId ?? "";
  const prep = (sql: string, ...args: unknown[]) =>
    db.prepare(sql).bind(...args);
  const all = async <T = Record<string, unknown>>(
    sql: string,
    ...args: unknown[]
  ) => (await prep(sql, ...args).all<T>()).results ?? [];
  const one = async <T = Record<string, unknown>>(
    sql: string,
    ...args: unknown[]
  ) => prep(sql, ...args).first<T>();
  const eventFor = async (id: string): Promise<CommunityEvent | null> => {
    const row = await one<{
      recordJson: string;
      status: CommunityEvent["status"];
    }>(
      "SELECT recordJson,status FROM community_events WHERE id=? AND communityId=?",
      id,
      communityId,
    );
    return row ? { ...JSON.parse(row.recordJson), status: row.status } : null;
  };
  const member = async () => {
    if (!identity) fail(401, "Sign in to continue.");
    const m = await one<{ communityId: string; role: string }>(
      "SELECT * FROM memberships WHERE userId=?",
      uid,
    );
    if (!m) fail(403, "An invitation is required to join this community.");
    return m!;
  };
  const isBlocked = async (target: string) =>
    !!(await one(
      "SELECT 1 FROM blocks WHERE (ownerId=? AND targetId=?) OR (ownerId=? AND targetId=?)",
      uid,
      target,
      target,
      uid,
    ));
  const visibility = (alias = "p") => ({
    sql: `NOT EXISTS(SELECT 1 FROM community_events ce WHERE ce.id=${alias}.subjectId AND ce.status='draft') AND ${alias}.deletedAt IS NULL AND ${alias}.communityId=? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=${alias}.authorId) OR (b.ownerId=${alias}.authorId AND b.targetId=?)) AND (${alias}.authorId=? OR ${alias}.audience='community' OR (${alias}.audience='friends' AND EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=? AND f.b=${alias}.authorId) OR (f.b=? AND f.a=${alias}.authorId)))))`,
    args: [communityId, uid, uid, uid, uid, uid],
  });
  const post = async (postId: string) => {
    const v = visibility();
    const p = await one<Post>(
      `SELECT p.* FROM posts p WHERE p.id=? AND ${v.sql}`,
      postId,
      ...v.args,
    );
    if (!p) fail(404, "This conversation is unavailable.");
    return p!;
  };
  const person = async (target: string) => {
    const p = await one<Person>(
      "SELECT p.* FROM profiles p JOIN memberships m ON m.userId=p.id WHERE p.id=? AND m.communityId=?",
      target,
      communityId,
    );
    if (!p || target === uid || (await isBlocked(target)))
      fail(404, "This person is unavailable.");
    return p!;
  };
  const validSubject = (subject: string) => {
    const issue = issueFor(subject);
    if (!issue) fail(400, "Choose an available subject.");
    return issue!;
  };
  async function decorate(rows: Post[]): Promise<Post[]> {
    return Promise.all(
      rows.map(async (p) => {
        const [reactions, myReaction, replies, saved] = await Promise.all([
          all<{ kind: string; count: number }>(
            `SELECT r.kind,COUNT(*) count FROM reactions r WHERE r.postId=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=r.userId) OR (b.ownerId=r.userId AND b.targetId=?)) GROUP BY r.kind`,
            p.id,
            uid,
            uid,
          ),
          one<{ kind: string }>(
            "SELECT kind FROM reactions WHERE postId=? AND userId=?",
            p.id,
            uid,
          ),
          one<{ count: number }>(
            `SELECT COUNT(*) count FROM comments c WHERE c.postId=? AND c.deletedAt IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?))`,
            p.id,
            uid,
            uid,
          ),
          one("SELECT 1 FROM saves WHERE userId=? AND targetId=?", uid, p.id),
        ]);
        let priorPostId = p.priorPostId;
        if (priorPostId) {
          try {
            await post(priorPostId);
          } catch {
            priorPostId = null;
          }
        }
        return {
          ...p,
          priorPostId,
          reactions,
          myReaction: myReaction?.kind ?? null,
          replyCount: replies?.count ?? 0,
          saved: !!saved,
        };
      }),
    );
  }
  async function snapshot(params: URLSearchParams): Promise<Snapshot> {
    if (!identity) return { ...emptySnapshot };
    const me = await one<Person>(
      "SELECT p.*,m.role FROM profiles p JOIN memberships m ON m.userId=p.id WHERE p.id=? AND m.communityId=?",
      uid,
      communityId,
    );
    if (!me)
      return {
        ...emptySnapshot,
        status: "onboarding",
        me: {
          id: uid,
          name: identity.displayName,
          username: "",
          bio: "",
          communityLabel: "Ithaca, NY",
        },
      };
    const v = visibility();
    let sql = `SELECT p.*,u.name,u.username FROM posts p JOIN profiles u ON u.id=p.authorId WHERE ${v.sql}`;
    const args: unknown[] = [...v.args];
    const postId = params.get("post");
    const filter = params.get("filter") ?? "friends";
    if (postId) {
      sql += " AND p.id=?";
      args.push(postId);
    } else {
      sql +=
        " AND NOT EXISTS(SELECT 1 FROM mutes WHERE ownerId=? AND targetId=p.authorId)";
      args.push(uid);
      if (filter === "friends") {
        sql += ` AND (p.authorId=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=? AND f.b=p.authorId) OR (f.b=? AND f.a=p.authorId))))`;
        args.push(uid, uid, uid);
      } else if (filter === "following") {
        sql +=
          " AND EXISTS(SELECT 1 FROM follows f WHERE f.userId=? AND f.issueId=p.issueId)";
        args.push(uid);
      } else if (filter === "community") {
        sql += ` AND p.audience='community'`;
      }
      if (params.get("issue")) {
        sql += " AND p.issueId=?";
        args.push(params.get("issue"));
      }
      if (params.get("event")) {
        sql += " AND p.subjectId=?";
        args.push(params.get("event"));
      }
      if (params.get("author")) {
        sql += " AND p.authorId=?";
        args.push(params.get("author") === "me" ? uid : params.get("author"));
      }
      if (filter === "saved") {
        sql +=
          " AND EXISTS(SELECT 1 FROM saves s WHERE s.userId=? AND s.targetId=p.id)";
        args.push(uid);
      }
      if (params.get("q")) {
        sql +=
          " AND (instr(lower(p.text),lower(?))>0 OR instr(lower(u.name),lower(?))>0)";
        args.push(
          params.get("q")?.slice(0, 100),
          params.get("q")?.slice(0, 100),
        );
      }
      const cursor = params.get("cursor");
      if (cursor) {
        const parts = cursor.split("|");
        if (parts.length !== 2) fail(400, "Invalid page cursor.");
        sql += " AND (p.createdAt<? OR (p.createdAt=? AND p.id<?))";
        args.push(parts[0], parts[0], parts[1]);
      }
    }
    sql += " ORDER BY p.createdAt DESC,p.id DESC LIMIT 21";
    const rows = await all<Post>(sql, ...args);
    if (postId && !rows.length) fail(404, "This conversation is unavailable.");
    const nextCursor =
      rows.length > 20 ? rows[19].createdAt + "|" + rows[19].id : null;
    const people = await all<Person>(
      `SELECT p.*,CASE WHEN f.status='accepted' THEN 'friends' WHEN f.requester=? THEN 'outgoing' WHEN f.status='pending' THEN 'incoming' ELSE 'none' END relationship,EXISTS(SELECT 1 FROM mutes WHERE ownerId=? AND targetId=p.id) muted,EXISTS(SELECT 1 FROM blocks WHERE ownerId=? AND targetId=p.id) blocked FROM profiles p JOIN memberships m ON m.userId=p.id LEFT JOIN friendships f ON (f.a=? AND f.b=p.id) OR (f.b=? AND f.a=p.id) WHERE p.id<>? AND m.communityId=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.ownerId=p.id AND b.targetId=?) ORDER BY p.name`,
      uid,
      uid,
      uid,
      uid,
      uid,
      uid,
      communityId,
      uid,
    );
    const visibleUsers = people
      .filter((p) => !p.blocked && !p.muted)
      .map((p) => p.id);
    const eventRows = await all<{
      recordJson: string;
      status: CommunityEvent["status"];
    }>(
      "SELECT recordJson,status FROM community_events WHERE communityId=? AND (status<>'draft' OR ? IN ('owner','curator')) ORDER BY startsAt,id LIMIT 1000",
      communityId,
      me.role ?? "member",
    );
    const events: CommunityEvent[] = eventRows.map((r) => ({
      ...JSON.parse(r.recordJson),
      status: r.status,
    }));
    const eventPrefs = await one<{
      city: string;
      interestsJson: string;
      complete: number;
    }>("SELECT * FROM event_preferences WHERE userId=?", uid);
    const [ranks, follows, saves, prefs, question, updates, plans] =
      await Promise.all([
        all<Snapshot["rankings"][number]>(
          "SELECT * FROM rankings WHERE userId=? ORDER BY priority,itemId",
          uid,
        ),
        all<Snapshot["follows"][number]>(
          "SELECT * FROM follows WHERE userId=?",
          uid,
        ),
        all<{ targetId: string }>(
          "SELECT targetId FROM saves WHERE userId=?",
          uid,
        ),
        one<Snapshot["preferences"]>(
          "SELECT * FROM preferences WHERE userId=?",
          uid,
        ),
        one<Question>(
          `SELECT * FROM questions WHERE status='scheduled' AND startsAt<=? AND endsAt>? ORDER BY startsAt DESC,id DESC LIMIT 1`,
          new Date().toISOString(),
          new Date().toISOString(),
        ),
        all<Snapshot["updates"][number]>(
          "SELECT * FROM issue_updates ORDER BY createdAt DESC LIMIT 50",
        ),
        all<Snapshot["plans"][number]>(
          `SELECT e.*,u.name FROM plans e JOIN profiles u ON u.id=e.userId WHERE e.userId=? OR (e.audience='community' OR (e.audience='friends' AND EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=? AND f.b=e.userId) OR (f.b=? AND f.a=e.userId)))))`,
          uid,
          uid,
          uid,
        ),
      ]);
    const visibleSaves: string[] = [];
    for (const s of saves) {
      if (catalogItem(s.targetId) || events.some((e) => e.id === s.targetId))
        visibleSaves.push(s.targetId);
      else {
        try {
          await post(s.targetId);
          visibleSaves.push(s.targetId);
        } catch {}
      }
    }
    const notices = await all<
      Snapshot["notifications"][number] & { actorId: string }
    >(
      `SELECT n.*,p.name FROM notifications n JOIN profiles p ON p.id=n.actorId WHERE n.userId=? AND NOT EXISTS(SELECT 1 FROM mutes WHERE ownerId=? AND targetId=n.actorId) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=n.actorId) OR (b.ownerId=n.actorId AND b.targetId=?)) ORDER BY n.createdAt DESC LIMIT 200`,
      uid,
      uid,
      uid,
      uid,
    );
    const notifications: Snapshot["notifications"] = [];
    for (const n of notices) {
      if (n.kind === "friend" || n.kind === "friend_request") {
        if (
          await one(
            "SELECT 1 FROM friendships WHERE id=? AND status=? AND (a=? OR b=?)",
            n.targetId,
            n.kind === "friend" ? "accepted" : "pending",
            uid,
            uid,
          )
        )
          notifications.push(n);
      } else if (n.kind === "issue") {
        if (
          await one(
            "SELECT 1 FROM follows WHERE userId=? AND issueId=? AND notify=1",
            uid,
            n.targetId,
          )
        )
          notifications.push(n);
      } else if (n.kind === "event") {
        if (
          await one(
            "SELECT 1 FROM plans WHERE userId=? AND eventId=?",
            uid,
            n.targetId,
          )
        )
          notifications.push(n);
      } else {
        try {
          await post(n.targetId);
          if (
            n.commentId &&
            !(await one(
              "SELECT 1 FROM comments WHERE id=? AND deletedAt IS NULL",
              n.commentId,
            ))
          )
            continue;
          notifications.push(n);
        } catch {}
      }
    }
    const counts = question
      ? await all<{ choice: string; count: number }>(
          `SELECT a.choice,COUNT(*) count FROM answers a WHERE a.questionId=? AND a.choice<>'skip' AND (a.audience='community' OR (a.audience='friends' AND (a.userId=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=? AND f.b=a.userId) OR (f.b=? AND f.a=a.userId)))))) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=a.userId) OR (b.ownerId=a.userId AND b.targetId=?)) GROUP BY a.choice`,
          question.id,
          uid,
          uid,
          uid,
          uid,
          uid,
        )
      : [];
    const answer = question
      ? await one<Snapshot["answer"]>(
          "SELECT choice,note,audience FROM answers WHERE userId=? AND questionId=?",
          uid,
          question.id,
        )
      : null;
    const lists = await all<NonNullable<Snapshot["lists"]>[number]>(
      `SELECT l.*,u.name FROM lists l JOIN posts p ON p.id=l.postId JOIN profiles u ON u.id=l.userId WHERE ${v.sql} ORDER BY p.createdAt DESC LIMIT 100`,
      ...v.args,
    );
    const commentWhere = `c.postId=? AND c.deletedAt IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?))`;
    let commentAfter = "";
    const commentArgs: unknown[] = [postId, uid, uid];
    if (params.get("commentsAfter")) {
      const parts = params.get("commentsAfter")!.split("|");
      if (parts.length !== 2) fail(400, "Invalid reply cursor.");
      commentAfter = " AND (c.createdAt>? OR (c.createdAt=? AND c.id>?))";
      commentArgs.push(parts[0], parts[0], parts[1]);
    }
    const commentRows = postId
      ? await all<NonNullable<Snapshot["comments"]>[number]>(
          `SELECT c.*,u.name FROM comments c JOIN profiles u ON u.id=c.authorId WHERE ${commentWhere}${commentAfter} ORDER BY c.createdAt,c.id LIMIT 101`,
          ...commentArgs,
        )
      : [];
    const nextCommentCursor =
      commentRows.length > 100
        ? commentRows[99].createdAt + "|" + commentRows[99].id
        : null;
    const comments = postId ? commentRows.slice(0, 100) : undefined;
    if (postId && params.get("comment")) {
      const target = params.get("comment");
      const extra = await all<NonNullable<Snapshot["comments"]>[number]>(
        `SELECT c.*,u.name FROM comments c JOIN profiles u ON u.id=c.authorId WHERE ${commentWhere} AND (c.id=? OR c.id=(SELECT parentId FROM comments WHERE id=? AND postId=?))`,
        postId,
        uid,
        uid,
        target,
        target,
        postId,
      );
      for (const row of extra) {
        if (!comments!.some((c) => c.id === row.id)) comments!.push(row);
      }
    }
    // Deep-link targets may be beyond the cursor page; keep their display order stable.
    comments?.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const admin =
      me.role === "owner"
        ? {
            invitationCodes: await all<NonNullable<Snapshot["admin"]>["invitationCodes"][number]>(
              "SELECT id,createdAt,expiresAt,maxUses,useCount,revokedAt FROM invitation_codes ORDER BY createdAt DESC LIMIT 100",
            ),
            invitations: await all<
              NonNullable<Snapshot["admin"]>["invitations"][number]
            >(
              "SELECT id,email,expiresAt,usedBy FROM invitations ORDER BY expiresAt DESC LIMIT 100",
            ),
            questions: await all<Question>(
              "SELECT * FROM questions ORDER BY startsAt DESC LIMIT 100",
            ),
            reports: await all<
              NonNullable<Snapshot["admin"]>["reports"][number]
            >(
              "SELECT id,reason,status,evidence FROM reports ORDER BY createdAt DESC LIMIT 100",
            ),
          }
        : undefined;
    return {
      events,
      eventPreferences: eventPrefs
        ? {
            city: eventPrefs.city,
            interests: JSON.parse(eventPrefs.interestsJson),
            complete: !!eventPrefs.complete,
          }
        : emptySnapshot.eventPreferences,
      eventSuggestions: await all<
        NonNullable<Snapshot["eventSuggestions"]>[number]
      >(
        "SELECT * FROM event_suggestions WHERE userId=? OR ? IN ('owner','curator') ORDER BY createdAt DESC LIMIT 100",
        uid,
        me.role ?? "member",
      ),
      me,
      status: "ready",
      posts: await decorate(rows.slice(0, 20)),
      nextCursor,
      people,
      rankings: ranks.filter((r) => catalogItem(r.itemId)),
      priorities: await all<Snapshot["priorities"][number]>(
        "SELECT issueId,priority,note FROM issue_priorities WHERE userId=? ORDER BY priority,issueId",
        uid,
      ),
      follows,
      plans: plans.filter(
        (p) =>
          (p.userId === uid || visibleUsers.includes(p.userId)) &&
          (!!catalogItem(p.eventId) || events.some((e) => e.id === p.eventId)),
      ),
      saved: visibleSaves,
      preferences: prefs ?? emptySnapshot.preferences,
      question: question ? { ...question, counts } : null,
      answer,
      updates,
      notifications,
      lists,
      comments,
      commentUnavailable:
        !!params.get("comment") &&
        !comments?.some((c) => c.id === params.get("comment")),
      nextCommentCursor,
      admin,
    };
  }
  async function executeOnce(input: unknown) {
    if (!identity) fail(401, "Sign in to continue.");
    const parsed = command.safeParse(input);
    if (!parsed.success)
      fail(
        400,
        parsed.error.issues[0]?.message ?? "Check the submitted values.",
      );
    const { requestId, data } = parsed.data!;
    if (
      Object.keys((input as { data: Record<string, unknown> }).data).some(
        (k) => !(k in data),
      )
    )
      fail(400, "This submission contains unsupported fields.");
    const now = new Date().toISOString();
    const key = await digest(uid + "|" + requestId);
    const fingerprint = await digest(JSON.stringify(data));
    const old = await one<{ fingerprint: string; resultJson: string }>(
      "SELECT * FROM requests WHERE id=? AND userId=?",
      key,
      uid,
    );
    if (old) {
      if (old.fingerprint !== fingerprint)
        fail(409, "This submission key was already used.");
      return JSON.parse(old.resultJson);
    }
    const sql: D1PreparedStatement[] = [];
    const add = (query: string, ...values: unknown[]) =>
      sql.push(prep(query, ...values));
    let result: Record<string, unknown> = { ok: true };
    const objectId = "p_" + key.slice(0, 28);
    const eventSubjects = new Map<string, CommunityEvent>();
    const guards: { query: string; values: unknown[] }[] = [];
    const guard = (query: string, ...values: unknown[]) =>
      guards.push({ query, values });
    const guardedEvent = async (id: string, upcoming = false) => {
      const e = await eventFor(id);
      if (!e || e.status === "draft") fail(404, "This event is unavailable.");
      if (upcoming && (e!.status !== "published" || eventExpired(e!)))
        fail(409, "This event is no longer accepting plans.");
      guard(
        "EXISTS(SELECT 1 FROM community_events WHERE id=? AND communityId=? AND status=? AND startsAt=? AND endsAt IS ?)",
        id,
        communityId,
        e!.status,
        e!.startsAt,
        e!.endsAt,
      );
      eventSubjects.set(id, e!);
      return e!;
    };
    const eventMetric = (kind: string) =>
      add(
        "INSERT INTO metrics(id,userId,event,objectId,createdAt) VALUES(?,?,?,NULL,?)",
        key + "_event",
        "aggregate",
        kind,
        now.slice(0, 10) + "T00:00:00.000Z",
      );
    const guardedPost = async (id: string) => {
      const p = await post(id);
      const v = visibility();
      guard(
        `EXISTS(SELECT 1 FROM posts p WHERE p.id=? AND ${v.sql})`,
        id,
        ...v.args,
      );
      return p;
    };
    const guardedOwnPost = async (id: string) => {
      const p = await guardedPost(id);
      if (p.authorId !== uid)
        fail(403, "Only the author can change this post.");
      return p;
    };
    const guardedPerson = async (target: string) => {
      const p = await person(target);
      guard(
        `EXISTS(SELECT 1 FROM memberships WHERE userId=? AND communityId=?) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (ownerId=? AND targetId=?) OR (ownerId=? AND targetId=?))`,
        target,
        communityId,
        uid,
        target,
        target,
        uid,
      );
      return p;
    };
    const notify = (
      recipient: string,
      kind: string,
      target: string,
      commentId: string | null = null,
      notificationKey = key,
    ) => {
      if (recipient === uid) return;
      add(
        `INSERT OR IGNORE INTO notifications(id,userId,actorId,kind,targetId,commentId,createdAt) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM mutes WHERE ownerId=? AND targetId=?) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (ownerId=? AND targetId=?) OR (ownerId=? AND targetId=?)) AND COALESCE((SELECT ${kind === "reaction" ? "reactions" : kind === "issue" ? "issues" : "replies"} FROM preferences WHERE userId=?),1)=1`,
        notificationKey + "_" + recipient,
        recipient,
        uid,
        kind,
        target,
        commentId,
        now,
        recipient,
        uid,
        recipient,
        uid,
        uid,
        recipient,
        recipient,
      );
    };
    const insertPost = (
      kind: string,
      subjectId: string,
      body: string,
      aud: string,
      pos: string | null = null,
      attachment: unknown = {},
      prior: string | null = null,
    ) => {
      const event = eventSubjects.get(subjectId);
      const issue = event ? { id: event.issueId } : validSubject(subjectId);
      add(
        "INSERT INTO posts(id,authorId,communityId,kind,subjectId,issueId,position,text,audience,attachmentJson,priorPostId,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        objectId,
        uid,
        communityId,
        kind,
        subjectId,
        issue.id,
        pos,
        body,
        aud,
        JSON.stringify({
          ...(attachment as object),
          ...(event ? { eventTitle: event.title, eventId: event.id } : {}),
        }),
        prior,
        now,
      );
      if (aud !== "only_me")
        add(
          "INSERT INTO metrics(id,userId,event,objectId,createdAt) VALUES(?,?,?,?,?)",
          key + "_post",
          uid,
          "post_created",
          objectId,
          now,
        );
      result = { ok: true, postId: objectId };
    };
    if (data.action === "join") {
      if (await one("SELECT 1 FROM memberships WHERE userId=?", uid))
        fail(409, "You already have a profile.");
      const owner =
        !!ownerEmail &&
        identity!.email.toLowerCase() === ownerEmail.toLowerCase();
      const invite = owner
        ? null
        : await one<{ id: string }>(
            "SELECT id FROM invitations WHERE tokenHash=? AND lower(email)=? AND usedBy IS NULL AND expiresAt>?",
            await digest(data.invite),
            identity!.email.toLowerCase(),
            now,
          );
      // Shared codes are case/spacing insensitive; legacy email-bound tokens
      // retain their exact digest and email checks above.
      const normalizedCode = data.invite.replace(/[\s-]/g, "").toUpperCase();
      const sharedCode = owner || invite ? null : await one<{ id: string }>(
        "SELECT id FROM invitation_codes WHERE tokenHash=? AND revokedAt IS NULL AND useCount<maxUses AND expiresAt>?",
        await digest(normalizedCode), now,
      );
      if (!owner && !invite && !sharedCode)
        fail(403, "Use an active invitation code, or an email invitation matching your signed-in email.");
      if (sharedCode)
        guard(
          "EXISTS(SELECT 1 FROM invitation_codes WHERE id=? AND revokedAt IS NULL AND useCount<maxUses AND expiresAt>?)",
          sharedCode.id, now,
        );
      if (invite)
        guard(
          "EXISTS(SELECT 1 FROM invitations WHERE id=? AND usedBy IS NULL AND expiresAt>?)",
          invite.id,
          now,
        );
      if (await one("SELECT 1 FROM profiles WHERE username=?", data.username))
        fail(409, "That username is taken.");
      add(
        "INSERT INTO profiles(id,name,username,createdAt) VALUES(?,?,?,?)",
        uid,
        data.name,
        data.username,
        now,
      );
      add(
        "INSERT INTO memberships(userId,communityId,role) VALUES(?,?,?)",
        uid,
        communityId,
        owner ? "owner" : "member",
      );
      if (invite)
        add(
          "UPDATE invitations SET usedBy=? WHERE id=? AND usedBy IS NULL",
          uid,
          invite.id,
        );
      if (sharedCode)
        add("UPDATE invitation_codes SET useCount=useCount+1 WHERE id=?", sharedCode.id);
      if (owner)
        add(
          `INSERT OR IGNORE INTO questions(id,issueId,title,background,sourceUrl,sample,optionsJson,startsAt,endsAt,status) VALUES('sample-housing','housing',?,?,?,?,?,?,?,'scheduled')`,
          "What would make downtown feel more like home?",
          "This is an illustrative question about the fictional More homes downtown proposal. Consider housing availability, affordability commitments, and infrastructure. Read the sample proposal before responding.",
          "https://www.cityofithaca.org/",
          1,
          JSON.stringify([
            "More homes",
            "Affordability commitments",
            "Better public spaces",
            "Still learning",
          ]),
          "2026-01-01T00:00:00.000Z",
          "2099-01-01T00:00:00.000Z",
        );
      add(
        "INSERT INTO metrics(id,userId,event,createdAt) VALUES(?,?,?,?)",
        key + "_joined",
        uid,
        "joined",
        now,
      );
    } else {
      const m = await member();
      guard(
        "EXISTS(SELECT 1 FROM memberships WHERE userId=? AND communityId=?)",
        uid,
        communityId,
      );
      const owner = () => {
        if (m.role !== "owner")
          fail(403, "Community owner access is required.");
        guard(
          "EXISTS(SELECT 1 FROM memberships WHERE userId=? AND role='owner')",
          uid,
        );
      };
      switch (data.action) {
        case "event.preferences":
          add(
            "INSERT INTO event_preferences(userId,city,interestsJson,complete) VALUES(?,?,?,?) ON CONFLICT(userId) DO UPDATE SET city=excluded.city,interestsJson=excluded.interestsJson,complete=excluded.complete",
            uid,
            data.city,
            JSON.stringify([...new Set(data.interests)]),
            +data.complete,
          );
          eventMetric("event_interests_saved");
          break;
        case "event.save": {
          if (!["owner", "curator"].includes(m.role))
            fail(403, "Curator access is required.");
          guard(
            "EXISTS(SELECT 1 FROM memberships WHERE userId=? AND role IN ('owner','curator'))",
            uid,
          );
          const e = data.event;
          if (e.endsAt && e.endsAt <= e.startsAt)
            fail(400, "End time must follow the start.");
          if ((e.latitude === null) !== (e.longitude === null))
            fail(400, "Supply both venue coordinates or neither.");
          if (e.issueId && !issues.some((i) => i.id === e.issueId))
            fail(400, "Choose a related issue or leave it blank.");
          if (Date.parse(e.checkedAt) > Date.now() + 60000)
            fail(400, "Source check time cannot be in the future.");
          if (catalogItem(e.id) || issues.some((i) => i.id === e.id))
            fail(400, "This event ID is reserved.");
          const existing = await eventFor(e.id);
          if (data.createOnly && existing) break;
          if (data.createOnly)
            guard(
              "NOT EXISTS(SELECT 1 FROM community_events WHERE id=?)",
              e.id,
            );
          add(
            "INSERT OR IGNORE INTO event_series(id,title) VALUES(?,?)",
            e.seriesId,
            e.title,
          );
          add(
            "INSERT INTO community_events(id,seriesId,communityId,recordJson,startsAt,endsAt,status,createdBy,updatedAt) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET seriesId=excluded.seriesId,recordJson=excluded.recordJson,startsAt=excluded.startsAt,endsAt=excluded.endsAt,status=excluded.status,updatedAt=excluded.updatedAt",
            e.id,
            e.seriesId,
            communityId,
            JSON.stringify(e),
            e.startsAt,
            e.endsAt,
            e.status,
            uid,
            now,
          );
          break;
        }
        case "event.status": {
          if (!["owner", "curator"].includes(m.role))
            fail(403, "Curator access is required.");
          guard(
            "EXISTS(SELECT 1 FROM memberships WHERE userId=? AND role IN ('owner','curator'))",
            uid,
          );
          if (!(await eventFor(data.eventId))) fail(404, "Event unavailable.");
          add(
            "UPDATE community_events SET status=?,updatedAt=? WHERE id=? AND communityId=?",
            data.status,
            now,
            data.eventId,
            communityId,
          );
          break;
        }
        case "event.suggest":
          add(
            "INSERT INTO event_suggestions(id,userId,title,sourceUrl,note,createdAt) VALUES(?,?,?,?,?,?)",
            objectId,
            uid,
            data.title,
            data.sourceUrl,
            data.note,
            now,
          );
          break;
        case "event.review":
          if (
            !(await one(
              "SELECT 1 FROM event_suggestions WHERE id=?",
              data.suggestionId,
            ))
          )
            fail(404, "Suggestion unavailable.");
          if (!["owner", "curator"].includes(m.role))
            fail(403, "Curator access is required.");
          guard(
            "EXISTS(SELECT 1 FROM memberships WHERE userId=? AND role IN ('owner','curator'))",
            uid,
          );
          add(
            "UPDATE event_suggestions SET status=? WHERE id=?",
            data.status,
            data.suggestionId,
          );
          break;
        case "event.metric":
          await guardedEvent(data.eventId);
          eventMetric(data.kind);
          break;
        case "profile":
          add(
            "UPDATE profiles SET name=?,bio=?,communityLabel=? WHERE id=?",
            data.name,
            data.bio,
            data.communityLabel,
            uid,
          );
          break;
        case "friend": {
          await guardedPerson(data.targetId);
          const [a, b] = [uid, data.targetId].sort();
          const f = await one<{
            id: string;
            status: string;
            requester: string;
          }>("SELECT * FROM friendships WHERE a=? AND b=?", a, b);
          if (data.operation === "request") {
            if (f) fail(409, "A friendship or request already exists.");
            add(
              `INSERT INTO friendships(id,a,b,requester,status) VALUES(?,?,?,?,'pending')`,
              objectId,
              a,
              b,
              uid,
            );
            notify(data.targetId, "friend_request", objectId);
          } else if (data.operation === "accept") {
            if (!f || f.status !== "pending" || f.requester === uid)
              fail(403, "Only the recipient can accept this request.");
            guard(
              "EXISTS(SELECT 1 FROM friendships WHERE id=? AND status='pending' AND requester<>?)",
              f!.id,
              uid,
            );
            add(`UPDATE friendships SET status='accepted' WHERE id=?`, f!.id);
            notify(data.targetId, "friend", f!.id);
            add(
              "INSERT INTO metrics(id,userId,event,objectId,createdAt) VALUES(?,?,?,?,?)",
              key + "_friend_requester",
              data.targetId,
              "friend_accepted",
              f!.id,
              now,
            );
            add(
              "INSERT INTO metrics(id,userId,event,objectId,createdAt) VALUES(?,?,?,?,?)",
              key + "_friend",
              uid,
              "friend_accepted",
              f!.id,
              now,
            );
          } else add("DELETE FROM friendships WHERE a=? AND b=?", a, b);
          break;
        }
        case "block": {
          if (uid === data.targetId) fail(400, "Choose another person.");
          if (data.enabled) {
            await guardedPerson(data.targetId);
            add(
              "INSERT OR IGNORE INTO blocks(ownerId,targetId) VALUES(?,?)",
              uid,
              data.targetId,
            );
            add(
              "DELETE FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)",
              uid,
              data.targetId,
              data.targetId,
              uid,
            );
            add(
              "DELETE FROM notifications WHERE (userId=? AND actorId=?) OR (userId=? AND actorId=?)",
              uid,
              data.targetId,
              data.targetId,
              uid,
            );
          } else
            add(
              "DELETE FROM blocks WHERE ownerId=? AND targetId=?",
              uid,
              data.targetId,
            );
          break;
        }
        case "mute":
          await guardedPerson(data.targetId);
          add(
            data.enabled
              ? "INSERT OR IGNORE INTO mutes(ownerId,targetId) VALUES(?,?)"
              : "DELETE FROM mutes WHERE ownerId=? AND targetId=?",
            uid,
            data.targetId,
          );
          break;
        case "post": {
          const item = catalogItem(data.subjectId);
          const event = !issueFor(data.subjectId)
            ? await guardedEvent(data.subjectId)
            : null;
          if (!event) validSubject(data.subjectId);
          if (
            data.kind === "article" &&
            !data.sourceUrl &&
            item?.kind !== "News"
          )
            fail(400, "Add the article’s HTTPS link.");
          if (
            (data.kind === "event_reflection" || data.kind === "event_share") &&
            item?.kind !== "Events" &&
            !event
          )
            fail(400, "Choose an event.");
          if (data.position && data.kind !== "opinion")
            fail(400, "Positions belong to opinion posts.");
          if (
            data.position &&
            item?.kind !== "Policies" &&
            !issues.some((i) => i.id === data.subjectId)
          )
            fail(400, "Choose an issue or policy for a position.");
          if (!data.text && !data.position)
            fail(400, "Add a view or a question.");
          if (data.priorPostId) {
            const earlier = await guardedOwnPost(data.priorPostId);
            if (
              earlier.subjectId !== data.subjectId ||
              earlier.audience !== data.audience
            )
              fail(
                400,
                "Link an earlier view on the same subject and audience.",
              );
          }
          insertPost(
            data.kind,
            data.subjectId,
            data.text,
            data.audience,
            data.position,
            { sourceUrl: data.sourceUrl },
            data.priorPostId,
          );

          break;
        }
        case "post.edit": {
          const p = await guardedOwnPost(data.postId);
          const attachment = {
            ...JSON.parse(p.attachmentJson || "{}"),
            ...(data.sourceUrl !== undefined
              ? { sourceUrl: data.sourceUrl }
              : {}),
          };
          if (
            p.kind === "article" &&
            catalogItem(p.subjectId)?.kind !== "News" &&
            !attachment.sourceUrl
          )
            fail(400, "Keep the article’s HTTPS link.");
          if (
            data.position &&
            (p.kind !== "opinion" ||
              (catalogItem(p.subjectId)?.kind !== "Policies" &&
                !issues.some((i) => i.id === p.subjectId)))
          )
            fail(400, "This post does not use a policy position.");
          if (!data.text && !data.position)
            fail(400, "A post needs a view or text.");
          add(
            "UPDATE posts SET text=?,position=?,attachmentJson=?,editedAt=? WHERE id=? AND authorId=?",
            data.text,
            data.position,
            JSON.stringify(attachment),
            now,
            data.postId,
            uid,
          );
          break;
        }
        case "post.delete":
          await guardedOwnPost(data.postId);
          add(
            "UPDATE posts SET text=?,attachmentJson=?,deletedAt=? WHERE id=?",
            "",
            "{}",
            now,
            data.postId,
          );
          add("DELETE FROM notifications WHERE targetId=?", data.postId);
          add("DELETE FROM lists WHERE postId=?", data.postId);
          add(
            "UPDATE comments SET text=?,deletedAt=? WHERE postId=?",
            "",
            now,
            data.postId,
          );
          break;
        case "reaction": {
          const p = await guardedPost(data.postId);
          if (data.kind) {
            add(
              "INSERT INTO reactions(userId,postId,kind) VALUES(?,?,?) ON CONFLICT(userId,postId) DO UPDATE SET kind=excluded.kind",
              uid,
              p.id,
              data.kind,
            );
            notify(
              p.authorId,
              "reaction",
              p.id,
              null,
              "reaction_" + p.id + "_" + uid,
            );
          } else {
            add("DELETE FROM reactions WHERE userId=? AND postId=?", uid, p.id);
            add(
              "DELETE FROM notifications WHERE id=?",
              "reaction_" + p.id + "_" + uid + "_" + p.authorId,
            );
          }
          break;
        }
        case "comment": {
          const p = await guardedPost(data.postId);
          let recipient = p.authorId;
          if (data.parentId) {
            const parent = await one<{
              postId: string;
              authorId: string;
              parentId: string | null;
            }>(
              "SELECT * FROM comments WHERE id=? AND deletedAt IS NULL",
              data.parentId,
            );
            if (
              !parent ||
              parent.postId !== p.id ||
              parent.parentId ||
              (await isBlocked(parent.authorId))
            )
              fail(
                400,
                "Reply to an available top-level comment in this conversation.",
              );
            recipient = parent!.authorId;
            guard(
              "EXISTS(SELECT 1 FROM comments WHERE id=? AND postId=? AND deletedAt IS NULL AND parentId IS NULL) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (ownerId=? AND targetId=?) OR (ownerId=? AND targetId=?))",
              data.parentId,
              p.id,
              uid,
              recipient,
              recipient,
              uid,
            );
          }
          add(
            "INSERT INTO comments(id,postId,authorId,parentId,text,createdAt) VALUES(?,?,?,?,?,?)",
            objectId,
            p.id,
            uid,
            data.parentId,
            data.text,
            now,
          );
          notify(recipient, "reply", p.id, objectId);
          if (recipient !== p.authorId)
            notify(p.authorId, "reply", p.id, objectId);
          if (p.audience !== "only_me")
            add(
              "INSERT INTO metrics(id,userId,event,objectId,createdAt) VALUES(?,?,?,?,?)",
              key + "_reply",
              uid,
              "reply_created",
              p.id,
              now,
            );
          result = { ok: true, commentId: objectId, postId: p.id };
          break;
        }
        case "comment.edit":
        case "comment.delete": {
          const c = await one<{ authorId: string; postId: string }>(
            "SELECT * FROM comments WHERE id=? AND deletedAt IS NULL",
            data.commentId,
          );
          if (!c) fail(404, "This reply is unavailable.");
          await guardedPost(c!.postId);
          if (c!.authorId !== uid)
            fail(403, "Only the author can change this reply.");
          if (data.action === "comment.edit")
            add(
              "UPDATE comments SET text=?,editedAt=? WHERE id=?",
              data.text,
              now,
              data.commentId,
            );
          else {
            add(
              "UPDATE comments SET text=?,deletedAt=? WHERE id=?",
              "",
              now,
              data.commentId,
            );
            add("DELETE FROM notifications WHERE commentId=?", data.commentId);
          }
          break;
        }
        case "save":
          if (!catalogItem(data.targetId)) {
            if (await eventFor(data.targetId))
              await guardedEvent(data.targetId);
            else await guardedPost(data.targetId);
          }
          add(
            data.enabled
              ? "INSERT OR IGNORE INTO saves(userId,targetId) VALUES(?,?)"
              : "DELETE FROM saves WHERE userId=? AND targetId=?",
            uid,
            data.targetId,
          );
          if (eventSubjects.has(data.targetId))
            eventMetric(data.enabled ? "event_saved" : "event_unsaved");
          break;
        case "onboarding.complete":
          add("UPDATE profiles SET onboardingComplete=1 WHERE id=?", uid);
          eventMetric("onboarding_completed");
          break;
        case "priority.save": {
          if (!issues.some((i) => i.id === data.issueId))
            fail(400, "Choose an available issue.");
          add(
            "INSERT INTO issue_priorities(userId,issueId,priority,note) VALUES(?,?,COALESCE((SELECT MAX(priority)+1 FROM issue_priorities WHERE userId=?),0),?) ON CONFLICT(userId,issueId) DO UPDATE SET note=CASE WHEN ? THEN excluded.note ELSE issue_priorities.note END",
            uid,
            data.issueId,
            uid,
            data.note ?? "",
            data.note !== undefined ? 1 : 0,
          );
          break;
        }
        case "priority.remove":
          add(
            "DELETE FROM issue_priorities WHERE userId=? AND issueId=?",
            uid,
            data.issueId,
          );
          break;
        case "priority.order": {
          const ids = data.issueIds;
          if (new Set(ids).size !== ids.length)
            fail(400, "Choose each issue once.");
          const placeholders = ids.map(() => "?").join(",");
          // Reject a stale reorder if another tab added or removed an issue.
          guard(
            `(SELECT COUNT(*) FROM issue_priorities WHERE userId=?)=? AND (SELECT COUNT(*) FROM issue_priorities WHERE userId=? AND issueId IN (${placeholders}))=?`,
            uid,
            ids.length,
            uid,
            ...ids,
            ids.length,
          );
          ids.forEach((id, index) =>
            add(
              "UPDATE issue_priorities SET priority=? WHERE userId=? AND issueId=?",
              index,
              uid,
              id,
            ),
          );
          break;
        }
        case "priority.share": {
          if (new Set(data.issueIds).size !== data.issueIds.length)
            fail(400, "Choose each issue once.");
          const rows = await all<Snapshot["priorities"][number]>(
            "SELECT issueId,priority,note FROM issue_priorities WHERE userId=? ORDER BY priority,issueId",
            uid,
          );
          const selected = rows.filter((r) =>
            data.issueIds.includes(r.issueId),
          );
          if (selected.length !== data.issueIds.length)
            fail(400, "Share only your own issue priorities.");
          const items = selected.map((r, index) => ({
            itemId: r.issueId,
            title: issues.find((i) => i.id === r.issueId)!.name,
            priority: index,
            ...(data.includeNotes ? { note: r.note } : {}),
          }));
          insertPost(
            "ranking",
            selected[0].issueId,
            data.text,
            data.audience,
            null,
            { rankingKind: "issue_priorities", title: data.title, items },
          );
          add(
            "INSERT INTO lists(id,postId,userId,title,itemsJson) VALUES(?,?,?,?,?)",
            objectId,
            objectId,
            uid,
            data.title,
            JSON.stringify(items),
          );
          break;
        }
        case "ranking": {
          const item = catalogItem(data.itemId);
          if (!item) fail(400, "Unknown civic item.");
          if (data.position && item!.kind !== "Policies")
            fail(400, "Only policies have positions.");
          add(
            "INSERT INTO rankings(userId,itemId,score,note,priority,position) VALUES(?,?,?,?,COALESCE((SELECT MAX(priority)+1 FROM rankings WHERE userId=?),0),?) ON CONFLICT(userId,itemId) DO UPDATE SET score=excluded.score,note=excluded.note,position=excluded.position",
            uid,
            data.itemId,
            data.score,
            data.note,
            uid,
            data.position,
          );
          break;
        }
        case "ranking.delete":
          add(
            "DELETE FROM rankings WHERE userId=? AND itemId=?",
            uid,
            data.itemId,
          );
          break;
        case "ranking.order": {
          const ranks = await all<{ itemId: string }>(
            "SELECT itemId FROM rankings WHERE userId=?",
            uid,
          );
          if (
            new Set(data.itemIds).size !== data.itemIds.length ||
            data.itemIds.some((id) => !ranks.some((r) => r.itemId === id))
          )
            fail(400, "Reorder your own unique ranking items.");
          data.itemIds.forEach((id, i) =>
            add(
              "UPDATE rankings SET priority=? WHERE userId=? AND itemId=?",
              i,
              uid,
              id,
            ),
          );
          break;
        }
        case "ranking.share": {
          if (new Set(data.itemIds).size !== data.itemIds.length)
            fail(400, "Choose unique items.");
          const ranks = await all<Snapshot["rankings"][number]>(
            "SELECT itemId,score,priority,position FROM rankings WHERE userId=? ORDER BY priority",
            uid,
          );
          const selected = data.itemIds.map((id) =>
            ranks.find((r) => r.itemId === id),
          );
          if (selected.some((r) => !r || !catalogItem(r.itemId)))
            fail(400, "Share only items you have ranked.");
          const snapshot = selected.map((r, index) => ({
            itemId: r!.itemId,
            score: r!.score,
            position: r!.position,
            priority: index,
            title: catalogItem(r!.itemId)!.title,
          }));
          insertPost(
            "ranking",
            selected[0]!.itemId,
            data.text,
            data.audience,
            null,
            { title: data.title, items: snapshot },
          );
          add(
            "INSERT INTO lists(id,postId,userId,title,itemsJson) VALUES(?,?,?,?,?)",
            objectId,
            objectId,
            uid,
            data.title,
            JSON.stringify(snapshot),
          );
          break;
        }
        case "follow":
          if (!issues.some((i) => i.id === data.issueId))
            fail(400, "Unknown issue.");
          if (data.enabled)
            add(
              "INSERT INTO follows(userId,issueId,notify) VALUES(?,?,?) ON CONFLICT(userId,issueId) DO UPDATE SET notify=excluded.notify",
              uid,
              data.issueId,
              +data.notify,
            );
          else
            add(
              "DELETE FROM follows WHERE userId=? AND issueId=?",
              uid,
              data.issueId,
            );
          break;
        case "plan": {
          const prior = await one<{ status: string; audience: string }>(
            "SELECT status,audience FROM plans WHERE userId=? AND eventId=?",
            uid,
            data.eventId,
          );
          // Existing intent can become private after cancellation or the event ends.
          // Inactive occurrences reject new intent or a different attendance status.
          if (!catalogItem(data.eventId)?.event)
            await guardedEvent(
              data.eventId,
              !!data.status && data.status !== prior?.status,
            );
          if (prior)
            guard(
              "EXISTS(SELECT 1 FROM plans WHERE userId=? AND eventId=? AND status=? AND audience=?)",
              uid,
              data.eventId,
              prior.status,
              prior.audience,
            );
          else
            guard(
              "NOT EXISTS(SELECT 1 FROM plans WHERE userId=? AND eventId=?)",
              uid,
              data.eventId,
            );
          // A second unchanged save must retain its conversation, replies, and reactions.
          if (
            (prior?.status === data.status &&
              prior.audience === data.audience) ||
            (!prior && !data.status)
          )
            break;
          if (data.status)
            add(
              "INSERT INTO plans(userId,eventId,status,audience) VALUES(?,?,?,?) ON CONFLICT(userId,eventId) DO UPDATE SET status=excluded.status,audience=excluded.audience",
              uid,
              data.eventId,
              data.status,
              data.audience,
            );
          else
            add(
              "DELETE FROM plans WHERE userId=? AND eventId=?",
              uid,
              data.eventId,
            );
          add(
            `UPDATE posts SET deletedAt=? WHERE authorId=? AND kind='event_plan' AND subjectId=? AND deletedAt IS NULL`,
            now,
            uid,
            data.eventId,
          );
          if (data.status && data.audience !== "only_me")
            insertPost(
              "event_plan",
              data.eventId,
              data.status === "attending"
                ? "Planning to attend. Who would like to join?"
                : "Interested in this event.",
              data.audience,
              null,
              { status: data.status },
            );
          if (eventSubjects.has(data.eventId))
            eventMetric("event_rsvp_changed");
          break;
        }
        case "answer": {
          const q = await one<Question>(
            `SELECT * FROM questions WHERE id=? AND status='scheduled' AND startsAt<=? AND endsAt>?`,
            data.questionId,
            now,
            now,
          );
          if (!q) fail(404, "This question is no longer accepting responses.");
          guard(
            "EXISTS(SELECT 1 FROM questions WHERE id=? AND status='scheduled' AND startsAt<=? AND endsAt>? AND optionsJson=?)",
            data.questionId,
            now,
            now,
            q!.optionsJson,
          );
          if (
            ![...JSON.parse(q!.optionsJson), "Still learning", "skip"].includes(
              data.choice,
            )
          )
            fail(400, "Choose an available response.");
          const aud = data.choice === "skip" ? "only_me" : data.audience;
          add(
            "INSERT INTO answers(userId,questionId,choice,note,audience) VALUES(?,?,?,?,?) ON CONFLICT(userId,questionId) DO UPDATE SET choice=excluded.choice,note=excluded.note,audience=excluded.audience",
            uid,
            data.questionId,
            data.choice,
            data.note,
            aud,
          );
          if (aud !== "only_me")
            insertPost(
              "question",
              q!.issueId,
              q!.title +
                "\n\n" +
                data.choice +
                (data.note ? " — " + data.note : ""),
              aud,
              null,
              { questionId: q!.id },
            );
          break;
        }
        case "notifications.read":
          add(
            "UPDATE notifications SET readAt=? WHERE userId=?" +
              (data.notificationId
                ? " AND id=?"
                : data.postId
                  ? " AND targetId=? AND kind='reaction'"
                  : ""),
            data.read ? now : null,
            uid,
            ...(data.notificationId
              ? [data.notificationId]
              : data.postId
                ? [data.postId]
                : []),
          );
          break;
        case "preferences":
          add(
            "INSERT INTO preferences(userId,replies,reactions,issues,events) VALUES(?,?,?,?,?) ON CONFLICT(userId) DO UPDATE SET replies=excluded.replies,reactions=excluded.reactions,issues=excluded.issues,events=excluded.events",
            uid,
            +data.replies,
            +data.reactions,
            +data.issues,
            +data.events,
          );
          break;
        case "report": {
          let evidence: unknown;
          try {
            evidence = (await eventFor(data.targetId))
              ? await guardedEvent(data.targetId)
              : await guardedPost(data.targetId);
          } catch {
            const c = await one<{ postId: string; authorId: string }>(
              "SELECT * FROM comments WHERE id=? AND deletedAt IS NULL",
              data.targetId,
            );
            if (!c || (await isBlocked(c.authorId)))
              fail(404, "This content is unavailable.");
            await guardedPost(c!.postId);
            evidence = c;
          }
          add(
            "INSERT INTO reports(id,reporterId,targetId,reason,evidence,createdAt) VALUES(?,?,?,?,?,?)",
            objectId,
            uid,
            data.targetId,
            data.reason,
            JSON.stringify(evidence),
            now,
          );
          break;
        }
        case "invite.code": {
          owner();
          // Twelve uniformly sampled base32 characters give 60 bits of entropy.
          const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
          const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => alphabet[byte % 32]).join("");
          const token = "POLIS-" + code.match(/.{4}/g)!.join("-");
          add("INSERT INTO invitation_codes(id,tokenHash,createdBy,createdAt,expiresAt,maxUses) VALUES(?,?,?,?,?,?)",
            objectId, await digest(token.replace(/-/g, "")), uid, now,
            new Date(Date.parse(now) + data.expiresDays * 86400000).toISOString(), data.maxUses);
          result = { ok: true, invitationCode: token };
          break;
        }
        case "invite.revoke": {
          owner();
          if (!(await one("SELECT id FROM invitation_codes WHERE id=?", data.codeId))) fail(404, "Invitation code unavailable.");
          add("UPDATE invitation_codes SET revokedAt=COALESCE(revokedAt,?) WHERE id=?", now, data.codeId);
          break;
        }
        case "invite": {
          owner();
          const token = crypto.randomUUID() + crypto.randomUUID();
          add(
            "INSERT INTO invitations(id,email,tokenHash,createdBy,expiresAt) VALUES(?,?,?,?,?)",
            objectId,
            data.email.toLowerCase(),
            await digest(token),
            uid,
            new Date(Date.now() + 7 * 86400000).toISOString(),
          );
          result = { ok: true, invite: token };
          break;
        }
        case "question.save":
          owner();
          if (!issues.some((i) => i.id === data.issueId))
            fail(400, "Unknown issue.");
          if (data.endsAt <= data.startsAt)
            fail(400, "End time must follow start time.");
          if (new Set(data.options).size !== data.options.length)
            fail(400, "Response options must be unique.");
          if (data.questionId) {
            if (
              !(await one(
                "SELECT 1 FROM questions WHERE id=?",
                data.questionId,
              ))
            )
              fail(404, "Question unavailable.");
            guard(
              "NOT EXISTS(SELECT 1 FROM answers WHERE questionId=?) OR EXISTS(SELECT 1 FROM questions WHERE id=? AND optionsJson=?)",
              data.questionId,
              data.questionId,
              JSON.stringify(data.options),
            );
            if (
              await one(
                "SELECT 1 FROM answers WHERE questionId=? LIMIT 1",
                data.questionId,
              )
            ) {
              const previous = await one<Question>(
                "SELECT * FROM questions WHERE id=?",
                data.questionId,
              );
              if (previous!.optionsJson !== JSON.stringify(data.options))
                fail(
                  400,
                  "Keep response options unchanged after someone answers.",
                );
            }
            add(
              "UPDATE questions SET issueId=?,title=?,background=?,sourceUrl=?,sample=?,optionsJson=?,startsAt=?,endsAt=?,status=? WHERE id=?",
              data.issueId,
              data.title,
              data.background,
              data.sourceUrl,
              +data.sample,
              JSON.stringify(data.options),
              data.startsAt,
              data.endsAt,
              data.status,
              data.questionId,
            );
          } else
            add(
              "INSERT INTO questions(id,issueId,title,background,sourceUrl,sample,optionsJson,startsAt,endsAt,status) VALUES(?,?,?,?,?,?,?,?,?,?)",
              objectId,
              data.issueId,
              data.title,
              data.background,
              data.sourceUrl,
              +data.sample,
              JSON.stringify(data.options),
              data.startsAt,
              data.endsAt,
              data.status,
            );
          break;
        case "issue.update": {
          owner();
          if (!issues.some((i) => i.id === data.issueId))
            fail(400, "Unknown issue.");
          add(
            "INSERT INTO issue_updates(id,issueId,title,sourceUrl,sample,createdAt) VALUES(?,?,?,?,?,?)",
            objectId,
            data.issueId,
            data.title,
            data.sourceUrl,
            +data.sample,
            now,
          );
          const followers = await all<{ userId: string }>(
            "SELECT userId FROM follows WHERE issueId=? AND notify=1",
            data.issueId,
          );
          followers.forEach((f) => notify(f.userId, "issue", data.issueId));
          break;
        }
        case "report.resolve":
          owner();
          {
            const r = await one<{ targetId: string }>(
              "SELECT targetId FROM reports WHERE id=?",
              data.reportId,
            );
            if (!r) fail(404, "Report unavailable.");
            add(
              `UPDATE reports SET status='resolved' WHERE id=?`,
              data.reportId,
            );
            if (data.removeContent) {
              add(
                "UPDATE community_events SET status='archived',updatedAt=? WHERE id=? AND communityId=?",
                now,
                r!.targetId,
                communityId,
              );
              add(
                "UPDATE posts SET text=?,attachmentJson=?,deletedAt=? WHERE id=?",
                "",
                "{}",
                now,
                r!.targetId,
              );
              add("DELETE FROM lists WHERE postId=?", r!.targetId);
              add(
                "UPDATE comments SET text=?,deletedAt=? WHERE id=? OR postId=?",
                "",
                now,
                r!.targetId,
                r!.targetId,
              );
              add(
                "DELETE FROM notifications WHERE targetId=? OR commentId=?",
                r!.targetId,
                r!.targetId,
              );
            }
            break;
          }
        case "visit": {
          add(
            "INSERT OR IGNORE INTO metrics(id,userId,event,createdAt) VALUES(?,?,?,?)",
            uid + "_" + now.slice(0, 10),
            uid,
            "active_day",
            now,
          );
          const pref = await one<{ events: number }>(
            "SELECT events FROM preferences WHERE userId=?",
            uid,
          );
          if (pref?.events) {
            const plans = await all<{ eventId: string }>(
              "SELECT eventId FROM plans WHERE userId=?",
              uid,
            );
            for (const p of plans) {
              const start = eventStart(p.eventId);
              if (
                start &&
                Date.parse(start) > Date.now() &&
                Date.parse(start) - Date.now() < 86400000
              )
                add(
                  "INSERT OR IGNORE INTO notifications(id,userId,actorId,kind,targetId,createdAt) VALUES(?,?,?,?,?,?)",
                  "event_" + uid + "_" + p.eventId,
                  uid,
                  uid,
                  "event",
                  p.eventId,
                  now,
                );
            }
          }
          break;
        }
      }
    }
    if (data.action === "plan")
      result.plan = {
        userId: uid,
        eventId: data.eventId,
        status: data.status,
        audience: data.status ? data.audience : "only_me",
      };
    const checks = guards.map((g, i) =>
      prep(
        "INSERT INTO write_guards(id,allowed) VALUES(?,CASE WHEN " +
          g.query +
          " THEN 1 ELSE 0 END)",
        key + "_" + i,
        ...g.values,
      ),
    );
    sql.unshift(...checks);
    if (checks.length)
      add(
        "DELETE FROM write_guards WHERE id IN (" +
          checks.map(() => "?").join(",") +
          ")",
        ...guards.map((_, i) => key + "_" + i),
      );
    // The command receipt shares a transaction with its writes. Concurrent duplicate
    // keys abort the losing batch, so activity and notification writes happen once.
    add(
      "INSERT INTO requests(id,userId,fingerprint,resultJson,createdAt) VALUES(?,?,?,?,?)",
      key,
      uid,
      fingerprint,
      JSON.stringify(result),
      now,
    );
    try {
      await db.batch(sql);
    } catch (error) {
      const prior = await one<{ fingerprint: string; resultJson: string }>(
        "SELECT fingerprint,resultJson FROM requests WHERE id=? AND userId=?",
        key,
        uid,
      );
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          fail(409, "This submission key was already used.");
        return JSON.parse(prior.resultJson);
      }
      if (
        error instanceof Error &&
        /write_allowed|UNIQUE constraint/i.test(error.message)
      )
        fail(409, "This item or invitation changed. Refresh and try again.");
      throw error;
    }
    return result;
  }
  async function execute(input: unknown) {
    try {
      return await executeOnce(input);
    } catch (error) {
      const parsed = command.safeParse(input);
      if (identity && parsed.success) {
        const key = await digest(uid + "|" + parsed.data.requestId);
        const saved = await one<{ fingerprint: string; resultJson: string }>(
          "SELECT fingerprint,resultJson FROM requests WHERE id=? AND userId=?",
          key,
          uid,
        );
        if (saved) {
          if (
            saved.fingerprint !==
            (await digest(JSON.stringify(parsed.data.data)))
          )
            fail(409, "This submission key was already used.");
          return JSON.parse(saved.resultJson);
        }
      }
      throw error;
    }
  }
  return { snapshot, execute };
}
