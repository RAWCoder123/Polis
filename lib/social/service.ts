import { z } from "zod";
import { itemById } from "../polis-data.ts";
import { eventActions, eventExpired } from "./events.ts";
import { issues, issueFor, eventStart } from "./catalog.ts";
import {
  campusDomainOf,
  communityFor,
  communityForEmail,
  communityFromRow,
  defaultCommunityId,
  localeOf,
  openCommunityId,
  pilotCommunities,
  type PilotCommunity,
  type PlaceCommunityRow,
} from "./communities.ts";
import { civicPlacesNear, reversePlace, searchPlaces, type Fetcher } from "./geo.ts";
import { groupStories, rankStories, type NewsArticle, type NewsStory, type StoryEngagement } from "./local-news.ts";
import { fetchCommunityNews, newsProfileFor } from "./news-sources.ts";
import { distanceMiles } from "./events.ts";
import { topicFor, pilotOrganizations, organizationFor } from "./commons.ts";
import {
  catalogFor,
  entityFor,
  inCatalog,
  replyTakesPosition as replyTakesPositionIn,
  subjectTakesPosition,
  topicFor as entityTopic,
} from "./civic/index.ts";
import {
  emptySnapshot,
  type Snapshot,
  type Person,
  type Post,
  type Question,
  type CommunityEvent,
  type CivicEntity,
  type CommonsSummary,
  type CommunityPlace,
  type CommunitySearchResult,
  type InvitationPreview,
} from "./types.ts";
// Campus admission needs an explicit assertion from an approved university
// verification adapter. Sites currently supplies no such assertion; an email
// string alone is insufficient. Never accept this flag in a client command.
export type Identity = { userId: string; email: string; displayName: string; verifiedCampusEmail?: boolean };
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
// Codes without an expiration keep working until an owner deactivates them.
export const NO_EXPIRY = "9999-12-31T23:59:59.999Z";
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
    action: z.literal("account.create"),
    name: z.string().trim().min(1).max(50),
    username: z.string().regex(/^[a-z0-9_]{3,24}$/),
  }),
  z.object({ action: z.literal("community.joinOpen") }),
  z.object({ action: z.literal("community.joinNational") }),
  z.object({ action: z.literal("community.manage"), communityId: id }),
  // Campus association from the trusted sign-in email domain.
  z.object({ action: z.literal("community.join"), communityId: id }),
  // Find or start a community for any city or town, or for the member's own
  // university email domain. Coordinates come from a place lookup or the
  // member's rounded device location.
  z.object({
    action: z.literal("community.create"),
    kind: z.enum(["city", "campus"]),
    city: z.string().trim().min(2).max(80),
    region: z.string().trim().max(80).default(""),
    country: z.string().trim().regex(/^([A-Z]{2})?$/).default(""),
    latitude: z.number().min(-85).max(85),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().max(64).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone."),
    university: z.string().trim().min(3).max(120).optional(),
  }),
  z.object({ action: z.literal("places.import") }),
  z.object({ action: z.literal("news.import") }),
  z.object({ action: z.literal("conversation.follow"), postId: id, enabled: z.boolean() }),
  z.object({ action: z.literal("conversation.visit"), postId: id }),
  z.object({ action: z.literal("organization.member"), organizationId: id, userId: id, role: z.enum(["member", "organizer", "remove"]) }),
  z.object({
    action: z.literal("join"),
    name: z.string().trim().min(1).max(50),
    username: z.string().regex(/^[a-z0-9_]{3,24}$/),
    invite: z.string().max(200).default(""),
    confirmedCommunityId: id.optional(),
  }),
  z.object({ action: z.literal("invite.redeem"), invite: z.string().max(200), confirmedCommunityId: id, name: z.string().trim().min(1).max(50).optional(), username: z.string().regex(/^[a-z0-9_]{3,24}$/).optional() }),
  z.object({ action: z.literal("community.select"), communityId: id }),
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
    title: z.string().trim().max(160).default(""),
    coverage: z.enum(["local", "national"]).default("local"),
    organizationId: id.nullable().default(null),
    organizationChannel: z.enum(["announcements", "discussion", "plans"]).default("discussion"),
    kind: z.enum([
      "opinion",
      "question",
      "debate",
      "update",
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
    title: z.string().trim().max(160).optional(),
    sourceUrl: z.union([source, z.literal("")]).optional(),
    postId: id,
    text,
    position: position.nullable().default(null),
  }),
  z.object({ action: z.literal("post.delete"), postId: id }),
  z.object({
    action: z.literal("reaction"),
    postId: id,
    // Agree · Disagree · Interesting · Needs context. Counts stay secondary in
    // the interface, and ranking uses distinct participants, not reactions.
    kind: z.enum(["agree", "disagree", "thoughtful", "curious"]).nullable(),
  }),
  z.object({
    action: z.literal("comment"),
    postId: id,
    parentId: id.nullable().default(null),
    text: text.refine((s) => s.length > 0, "Write a reply."),
    position: position.nullable().default(null),
  }),
  z.object({
    action: z.literal("comment.edit"),
    commentId: id,
    text: text.refine((s) => s.length > 0),
    position: position.nullable().optional(),
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
  z.object({
    action: z.literal("invite.code"),
    communityId: id.optional(),
    organizationId: id.optional(),
    maxUses: z.number().int().min(1).max(10000).nullable().default(25),
    // null keeps the code valid until an owner deactivates it.
    expiresDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90), z.null()]).default(7),
    // Optional memorable code such as CORNELL26 or POLIS-UF.
    code: z.string().trim().max(40).optional(),
  }),
  z.object({ action: z.literal("invite.revoke"), codeId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("invite.reactivate"), codeId: z.string().min(1).max(100) }),
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
  .object({ requestId: z.string().uuid(), communityId: id.optional(), data: action })
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
// Network lookups (place search, public places) are injected so the service
// stays testable; without a fetcher those features report unavailable.
export type ServiceOptions = { fetch?: Fetcher; contact?: string };
let lastPlaceLookup = 0;
// OpenStreetMap's Nominatim asks for at most one request per second.
async function placeLookupSlot() {
  const wait = Math.max(0, lastPlaceLookup + 1100 - Date.now());
  lastPlaceLookup = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}
export function socialService(
  db: Database,
  identity: Identity | null,
  ownerEmail = "",
  options: ServiceOptions = {},
) {
  const uid = identity?.userId ?? "";
  let communityId = defaultCommunityId;
  let currentCommunity: PilotCommunity | null = null;
  let currentPlaces: CommunityPlace[] = [];
  let currentNews: NewsStory[] = [];
  // The active community's civic catalog: curated for configured campuses,
  // generated plus imported public places everywhere else.
  let catalog: CivicEntity[] = [];
  const findEntity = (id: string) => inCatalog(catalog, id);
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
  const communityCache = new Map<string, PilotCommunity | null>();
  // Configured communities first, then communities members created.
  const communityRecord = async (id: string) => {
    const configured = communityFor(id);
    if (configured) return configured;
    if (!communityCache.has(id)) {
      const row = await one<PlaceCommunityRow>("SELECT * FROM place_communities WHERE id=? AND status='active'", id);
      communityCache.set(id, row ? communityFromRow(row) : null);
    }
    return communityCache.get(id) ?? null;
  };
  // Exact configured domains, then a campus community founded under the
  // member's plain institutional domain.
  const campusForEmail = async (email: string) => {
    const configured = communityForEmail(email);
    if (configured) return configured;
    const domain = campusDomainOf(email);
    if (!domain) return undefined;
    const row = await one<PlaceCommunityRow>("SELECT * FROM place_communities WHERE domain=? AND status='active'", domain);
    return row ? communityFromRow(row) : undefined;
  };
  // Email domains only associate a campus when the sign-in provider asserts the
  // address is verified. Sites supplies no such assertion yet, so campuses are
  // joined with invitation codes until an approved adapter provides one.
  const verifiedCampusFor = async (who: Identity) =>
    who.verifiedCampusEmail ? campusForEmail(who.email) : undefined;
  const verifiedCampusDomain = (who: Identity) => (who.verifiedCampusEmail ? campusDomainOf(who.email) : null);
  const resolveCommunity = async (requested?: string | null) => {
    const profile = uid ? await one<{ activeCommunityId: string }>("SELECT activeCommunityId FROM profiles WHERE id=?", uid) : null;
    communityId = requested ?? profile?.activeCommunityId ?? defaultCommunityId;
    currentCommunity = await communityRecord(communityId);
    if (!currentCommunity) fail(404, "This community is unavailable.");
    // Communities without a curated catalog show imported public places.
    const curated = catalogFor(currentCommunity, []).some((e) => e.communityId === communityId && !e.id.startsWith(communityId + "."));
    currentPlaces = !curated && localeOf(currentCommunity)
      ? await all<CommunityPlace>(
          "SELECT communityId,id,kind,name,subtitle,latitude,longitude,source,sourceRef,website FROM community_places WHERE communityId=? ORDER BY name LIMIT 200",
          communityId,
        )
      : [];
    // Local news stories from the last three weeks become discussable subjects.
    const newsProfile = newsProfileFor(currentCommunity);
    currentNews = newsProfile
      ? groupStories(
          (
            await all<Omit<NewsArticle, "sections"> & { sectionsJson: string }>(
              "SELECT id,url,title,source,domain,publishedAt,imageUrl,summary,origin,sectionsJson FROM community_news WHERE communityId=? AND publishedAt>=? ORDER BY publishedAt DESC LIMIT 300",
              communityId,
              new Date(Date.now() - 21 * 86400000).toISOString(),
            )
          ).map(({ sectionsJson, ...a }) => ({ ...a, sections: JSON.parse(sectionsJson) as string[] })),
          newsProfile,
        )
      : [];
    catalog = catalogFor(currentCommunity, currentPlaces, currentNews);
  };
  const pilotOwner = () => !!identity && !!ownerEmail && identity.email.toLowerCase() === ownerEmail.toLowerCase();
  const normalizeCode = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();
  const previewInvitation = async (value: unknown): Promise<InvitationPreview> => {
    // Generated codes are POLIS + 12 base32 characters; owner-chosen codes are
    // 6–32 letters or digits. Both are looked up only by their digest.
    if (typeof value !== "string" || value.length > 200 || !/^[A-Z0-9]{6,32}$/.test(normalizeCode(value)))
      fail(403, "This code is invalid, expired, revoked, or fully used. Ask the organizer for a new code.");
    const code = await one<{ communityId: string; organizationId: string | null; expiresAt: string; useCount: number; maxUses: number; unlimited: number; revokedAt: string | null }>(
      "SELECT communityId,organizationId,expiresAt,useCount,maxUses,unlimited,revokedAt FROM invitation_codes WHERE tokenHash=?", await digest(normalizeCode(value as string)),
    );
    const community = code && await communityRecord(code.communityId);
    const organization = code?.organizationId ? organizationFor(code.organizationId) : undefined;
    if (code?.organizationId && (!organization || organization.communityId !== code.communityId)) fail(403, "This organization invitation is unavailable.");
    const alreadyJoined = !!code && !!uid && !!await one(organization ? "SELECT 1 FROM organization_memberships WHERE userId=? AND organizationId=?" : "SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?", uid, organization?.id ?? code.communityId);
    if (!code || !community || (!alreadyJoined && (code.revokedAt || Date.parse(code.expiresAt) <= Date.now() || (!code.unlimited && code.useCount >= code.maxUses))))
      fail(403, "This code is invalid, expired, revoked, or fully used. Ask the organizer for a new code.");
    return { community: community!, ...(organization ? { organization: { id: organization.id, name: organization.name } } : {}), expiresAt: code!.expiresAt, alreadyJoined };
  };
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
      "SELECT * FROM pilot_memberships WHERE userId=? AND communityId=?",
      uid, communityId,
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
    sql: `(${alias}.organizationId IS NULL OR EXISTS(SELECT 1 FROM organization_memberships om WHERE om.organizationId=${alias}.organizationId AND om.userId=?)) AND NOT EXISTS(SELECT 1 FROM community_events ce WHERE ce.id=${alias}.subjectId AND ce.communityId=${alias}.communityId AND ce.status='draft') AND ${alias}.deletedAt IS NULL AND ${alias}.communityId=? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=${alias}.authorId) OR (b.ownerId=${alias}.authorId AND b.targetId=?)) AND (${alias}.authorId=? OR ${alias}.audience='community' OR (${alias}.audience='friends' AND EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=? AND f.b=${alias}.authorId) OR (f.b=? AND f.a=${alias}.authorId)))))`,
    args: [uid, communityId, uid, uid, uid, uid, uid],
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
      "SELECT p.* FROM profiles p JOIN pilot_memberships m ON m.userId=p.id WHERE p.id=? AND m.communityId=?",
      target,
      communityId,
    );
    if (!p || target === uid || (await isBlocked(target)))
      fail(404, "This person is unavailable.");
    return p!;
  };
  const validSubject = (subject: string) => {
    if (subject === "community") return { id: "" };
    // Sourced topics and civic entities belong to exactly one community.
    const entity = findEntity(subject);
    if (entity) return { id: entityTopic(entity) };
    if (entityFor(subject)) fail(400, "Choose a subject in your current community.");
    if (communityId !== defaultCommunityId) fail(400, "This subject is not available in this community. Share a community observation instead.");
    const issue = issueFor(subject);
    if (!issue) fail(400, "Choose an available subject.");
    return issue!;
  };
  const replyTakesPosition = (p: { kind: string; subjectId: string }) =>
    replyTakesPositionIn(catalog, communityId, p);
  const positionable = (subject: string) => subjectTakesPosition(catalog, communityId, subject);
  async function decorate(rows: Post[]): Promise<Post[]> {
    return Promise.all(
      rows.map(async (p) => {
        const [reactions, myReaction, replies, saved, repliers] = await Promise.all([
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
          one<{ count: number; latest: string | null }>(
            `SELECT COUNT(*) count,MAX(c.createdAt) latest FROM comments c WHERE c.postId=? AND c.deletedAt IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?)) AND NOT EXISTS(SELECT 1 FROM mutes mu WHERE mu.ownerId=? AND mu.targetId=c.authorId)`,
            p.id,
            uid,
            uid,
            uid,
          ),
          one("SELECT 1 FROM saves WHERE userId=? AND targetId=?", uid, p.id),
          one<{ count: number }>(
            `SELECT COUNT(DISTINCT c.authorId) count FROM comments c WHERE c.postId=? AND c.deletedAt IS NULL AND c.authorId<>? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?)) AND NOT EXISTS(SELECT 1 FROM mutes mu WHERE mu.ownerId=? AND mu.targetId=c.authorId)`,
            p.id,
            p.authorId,
            uid,
            uid,
            uid,
          ),
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
          participantCount: 1 + (repliers?.count ?? 0),
          latestActivity: replies?.latest ?? p.editedAt ?? p.createdAt,
          following: !!await one("SELECT 1 FROM conversation_follows WHERE userId=? AND postId=?", uid, p.id),
          saved: !!saved,
        };
      }),
    );
  }
  const notMuted = "NOT EXISTS(SELECT 1 FROM mutes WHERE ownerId=? AND targetId=p.authorId)";
  const replyVisible =
    "c.deletedAt IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?)) AND NOT EXISTS(SELECT 1 FROM mutes mu WHERE mu.ownerId=? AND mu.targetId=c.authorId)";
  // Conversations the viewer can see from the last two weeks, by subject,
  // counted as distinct people. Shared by the Commons and local news.
  async function discussionTopics(v: { sql: string; args: unknown[] }) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const recentPosts = await all<{ subjectId: string; authorId: string }>(
      `SELECT p.subjectId,p.authorId FROM posts p WHERE ${v.sql} AND p.audience<>'only_me' AND p.organizationId IS NULL AND ${notMuted} AND p.createdAt>=? LIMIT 1000`,
      ...v.args, uid, since,
    );
    const recentReplies = await all<{ subjectId: string; authorId: string }>(
      `SELECT p.subjectId,c.authorId FROM comments c JOIN posts p ON p.id=c.postId WHERE ${v.sql} AND p.audience<>'only_me' AND p.organizationId IS NULL AND ${notMuted} AND ${replyVisible} AND c.createdAt>=? LIMIT 3000`,
      ...v.args, uid, uid, uid, uid, since,
    );
    const topics = new Map<string, { posts: number; replies: number; people: Set<string> }>();
    const topic = (id: string) => {
      if (!topics.has(id)) topics.set(id, { posts: 0, replies: 0, people: new Set() });
      return topics.get(id)!;
    };
    for (const p of recentPosts) {
      if (p.subjectId === "community") continue;
      topic(p.subjectId).posts++;
      topic(p.subjectId).people.add(p.authorId);
    }
    for (const r of recentReplies) {
      if (r.subjectId === "community") continue;
      topic(r.subjectId).replies++;
      topic(r.subjectId).people.add(r.authorId);
    }
    return topics;
  }
  // What people in this community are discussing, counted as distinct people.
  async function commonsSummary(
    v: { sql: string; args: unknown[] },
    catalog: CivicEntity[],
    topics: Awaited<ReturnType<typeof discussionTopics>>,
  ): Promise<CommonsSummary> {
    const questionIds = catalog.filter((e) => e.kind === "question").map((e) => e.id);
    const marks = questionIds.map(() => "?").join(",");
    const stances = questionIds.length
      ? [
          ...(await all<{ subjectId: string; authorId: string; position: string | null; createdAt: string; response: number }>(
            `SELECT p.subjectId,p.authorId,p.position,p.createdAt,1 response FROM posts p WHERE ${v.sql} AND p.audience<>'only_me' AND p.organizationId IS NULL AND ${notMuted} AND p.subjectId IN (${marks})`,
            ...v.args, uid, ...questionIds,
          )),
          ...(await all<{ subjectId: string; authorId: string; position: string | null; createdAt: string; response: number }>(
            `SELECT p.subjectId,c.authorId,c.position,c.createdAt,0 response FROM comments c JOIN posts p ON p.id=c.postId WHERE ${v.sql} AND p.audience<>'only_me' AND p.organizationId IS NULL AND ${notMuted} AND ${replyVisible} AND p.subjectId IN (${marks})`,
            ...v.args, uid, uid, uid, uid, ...questionIds,
          )),
        ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : [];
    return {
      topics: [...topics.entries()]
        .map(([subjectId, t]) => ({ subjectId, posts: t.posts, replies: t.replies, participants: t.people.size }))
        .sort((a, b) => b.participants - a.participants || b.posts + b.replies - (a.posts + a.replies))
        .slice(0, 8),
      questions: questionIds.map((qid) => {
        const rows = stances.filter((r) => r.subjectId === qid);
        // Each person's most recent stated perspective counts once.
        const latest = new Map<string, string>();
        for (const r of rows) if (r.position) latest.set(r.authorId, r.position);
        const counts = new Map<string, number>();
        for (const pos of latest.values()) counts.set(pos, (counts.get(pos) ?? 0) + 1);
        return {
          id: qid,
          responses: rows.filter((r) => r.response).length,
          participants: new Set(rows.map((r) => r.authorId)).size,
          positions: [...counts.entries()].map(([position, count]) => ({ position, count })),
        };
      }),
    };
  }
  async function snapshot(params: URLSearchParams): Promise<Snapshot> {
    if (!identity) return { ...emptySnapshot };
    await resolveCommunity(params.get("community"));
    const me = await one<Person>(
      "SELECT p.*,m.role FROM profiles p JOIN pilot_memberships m ON m.userId=p.id WHERE p.id=? AND m.communityId=?",
      uid,
      communityId,
    );
    if (!me) {
      if (await one("SELECT 1 FROM profiles WHERE id=?", uid)) fail(403, "Join this community with an invitation code first.");
      return {
        ...emptySnapshot,
        status: "onboarding",
        eligibleCommunity: (await verifiedCampusFor(identity)) ?? null,
        unclaimedCampusDomain: (await verifiedCampusFor(identity)) ? null : verifiedCampusDomain(identity),
        me: {
          id: uid,
          name: identity.displayName,
          username: "",
          bio: "",
          communityLabel: "",
        },
      };
    }
    const nationalJoined = !!await one("SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?", uid, openCommunityId);
    if (params.get("scope") === "polis" && params.get("coverage") === "national") {
      if (!nationalJoined) {
        const fallback = new URLSearchParams(params); fallback.delete("scope");
        const shell = await snapshot(fallback);
        return { ...shell, nationalJoined: false, posts: [], nextCursor: null };
      }
      if (communityId !== openCommunityId) {
        const wider = new URLSearchParams(params); wider.set("community", openCommunityId);
        return snapshot(wider);
      }
    }
    const v = visibility();
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
    // Campus and Local tabs follow the subject: campus entities and general
    // community posts are Campus; city entities, legacy items and events are Local.
    const scopeSubjects = (scope: "campus" | "city") => [
      ...catalog.filter((e) => e.scope === (scope === "campus" ? "campus" : "local")).map((e) => e.id),
      // General posts are Campus in a university community and Local elsewhere.
      ...((scope === "campus") === !!currentCommunity!.campus ? ["community"] : []),
      ...(scope === "city" && communityId === defaultCommunityId ? Object.keys(itemById) : []),
      ...events
        .filter((e) => (e.scope === "campus" && e.campusId === communityId) === (scope === "campus"))
        .map((e) => e.id),
    ];
    const userFollows = await all<Snapshot["follows"][number]>(
      "SELECT * FROM follows WHERE userId=?",
      uid,
    );
    const activeSort = params.get("sort") === "active";
    const activitySql = `MAX(COALESCE(p.editedAt,p.createdAt),COALESCE((SELECT MAX(c.createdAt) FROM comments c WHERE c.postId=p.id AND c.deletedAt IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?)) AND NOT EXISTS(SELECT 1 FROM mutes m WHERE m.ownerId=? AND m.targetId=c.authorId)),p.createdAt))`;
    let sql = `SELECT p.*,u.name,u.username,${activitySql} activitySort FROM posts p JOIN profiles u ON u.id=p.authorId WHERE ${v.sql}`;
    const args: unknown[] = [uid, uid, uid, ...v.args];
    const postId = params.get("post");
    const filter = params.get("filter") ?? "friends";
    const organizationId = params.get("organization");
    const org = organizationId ? organizationFor(organizationId) : null;
    const orgMembership = org && org.communityId === communityId ? await one<{ role: string }>("SELECT role FROM organization_memberships WHERE userId=? AND organizationId=?", uid, org.id) : null;
    if (organizationId && (!org || !orgMembership)) fail(404, "This organization space is unavailable. Join with its code after joining the campus.");
    if (postId) {
      sql += " AND p.id=?";
      args.push(postId);
    } else {
      if (["local", "national"].includes(params.get("coverage") ?? "")) {
        sql += " AND p.coverage=?"; args.push(params.get("coverage"));
      }
      if (params.get("subject")) { sql += " AND p.subjectId=?"; args.push(params.get("subject")); }
      // Entity pages: an issue includes everything filed under it.
      const entityParam = params.get("entity");
      if (entityParam) {
        if (findEntity(entityParam)?.kind === "issue") {
          sql += " AND (p.issueId=? OR p.subjectId=?)";
          args.push(entityParam, entityParam);
        } else {
          sql += " AND p.subjectId=?";
          args.push(entityParam);
        }
      }
      if (org) {
        sql += " AND p.organizationId=?"; args.push(org.id);
        const channel = params.get("channel");
        if (channel && ["announcements", "discussion", "plans"].includes(channel)) {
          sql += " AND json_extract(p.attachmentJson,'$.organizationChannel')=?"; args.push(channel);
        }
      } else if (!["saved", "conversations"].includes(filter)) sql += " AND p.organizationId IS NULL";
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
      } else if (filter === "conversations") {
        sql += " AND EXISTS(SELECT 1 FROM conversation_follows f WHERE f.userId=? AND f.postId=p.id)";
        args.push(uid);
      } else if (filter === "campus" || filter === "city") {
        const subjects = scopeSubjects(filter);
        sql += subjects.length
          ? ` AND p.subjectId IN (${subjects.map(() => "?").join(",")})`
          : " AND 0";
        args.push(...subjects);
      } else if (filter === "followed") {
        // Commons "Following": followed threads, followed topics, places or
        // offices, and accepted friends.
        // Followed threads always appear, including your own; topics and
        // friends add other people's posts.
        sql += ` AND (EXISTS(SELECT 1 FROM conversation_follows cf WHERE cf.userId=? AND cf.postId=p.id) OR (p.authorId<>? AND (EXISTS(SELECT 1 FROM follows f WHERE f.userId=? AND (f.issueId=p.issueId OR f.issueId=p.subjectId)) OR EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=? AND f.b=p.authorId) OR (f.b=? AND f.a=p.authorId))))))`;
        args.push(uid, uid, uid, uid, uid);
      }
      if (["campus", "city", "followed", "for_you", "trending"].includes(filter))
        sql += " AND p.audience<>'only_me'";
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
          " AND (instr(lower(p.title || ' ' || p.text),lower(?))>0 OR instr(lower(u.name),lower(?))>0)";
        args.push(
          params.get("q")?.slice(0, 100),
          params.get("q")?.slice(0, 100),
        );
      }
      const cursor = params.get("cursor");
      if (cursor) {
        const parts = cursor.split("|");
        if (parts.length !== 2) fail(400, "Invalid page cursor.");
        sql += activeSort ? " AND (activitySort<? OR (activitySort=? AND p.id<?))" : " AND (p.createdAt<? OR (p.createdAt=? AND p.id<?))";
        args.push(parts[0], parts[0], parts[1]);
      }
    }
    sql += activeSort ? " ORDER BY activitySort DESC,p.id DESC LIMIT 21" : " ORDER BY p.createdAt DESC,p.id DESC LIMIT 21";
    const rows = await all<Post>(sql, ...args);
    if (postId && !rows.length) fail(404, "This conversation is unavailable.");
    const nextCursor = rows.length > 20
      ? (activeSort ? rows[19].activitySort : rows[19].createdAt) + "|" + rows[19].id
      : null;
    const people = await all<Person>(
      `SELECT p.*,CASE WHEN f.status='accepted' THEN 'friends' WHEN f.requester=? THEN 'outgoing' WHEN f.status='pending' THEN 'incoming' ELSE 'none' END relationship,EXISTS(SELECT 1 FROM mutes WHERE ownerId=? AND targetId=p.id) muted,EXISTS(SELECT 1 FROM blocks WHERE ownerId=? AND targetId=p.id) blocked FROM profiles p JOIN pilot_memberships m ON m.userId=p.id LEFT JOIN friendships f ON (f.a=? AND f.b=p.id) OR (f.b=? AND f.a=p.id) WHERE p.id<>? AND m.communityId=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.ownerId=p.id AND b.targetId=?) ORDER BY p.name`,
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
    const eventPrefs = await one<{
      city: string;
      interestsJson: string;
      complete: number;
    }>("SELECT * FROM event_preferences WHERE userId=?", uid);
    const follows = userFollows;
    const [ranks, saves, prefs, question, updates, plans] =
      await Promise.all([
        all<Snapshot["rankings"][number]>(
          "SELECT * FROM rankings WHERE userId=? ORDER BY priority,itemId",
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
          `SELECT * FROM questions WHERE ?='ithaca' AND status='scheduled' AND startsAt<=? AND endsAt>? ORDER BY startsAt DESC,id DESC LIMIT 1`,
          communityId,
          new Date().toISOString(),
          new Date().toISOString(),
        ),
        all<Snapshot["updates"][number]>(
          "SELECT * FROM issue_updates WHERE communityId=? ORDER BY createdAt DESC LIMIT 50", communityId,
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
      if ((communityId === defaultCommunityId && catalogItem(s.targetId)) || findEntity(s.targetId) || events.some((e) => e.id === s.targetId))
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
        if (!people.some(p => p.id === n.actorId)) continue;
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
        if (!findEntity(n.targetId)) continue;
        if (
          await one(
            "SELECT 1 FROM follows WHERE userId=? AND issueId=? AND notify=1",
            uid,
            n.targetId,
          )
        )
          notifications.push(n);
      } else if (n.kind === "event") {
        if (!events.some(e => e.id === n.targetId)) continue;
        if (
          await one(
            "SELECT 1 FROM plans WHERE userId=? AND eventId=?",
            uid,
            n.targetId,
          )
        )
          notifications.push(n);
      } else {
        const previousCommunity = communityId;
        try {
          const destination = await one<{ communityId: string }>("SELECT p.communityId FROM posts p JOIN pilot_memberships m ON m.communityId=p.communityId AND m.userId=? WHERE p.id=?", uid, n.targetId);
          if (!destination) continue;
          communityId = destination.communityId;
          await post(n.targetId);
          if (
            n.commentId &&
            !(await one(
              "SELECT 1 FROM comments WHERE id=? AND deletedAt IS NULL",
              n.commentId,
            ))
          )
            continue;
          notifications.push({ ...n, communityId });
        } catch {} finally { communityId = previousCommunity; }
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
    const commentWhere = `c.postId=? AND c.deletedAt IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=c.authorId) OR (b.ownerId=c.authorId AND b.targetId=?)) AND NOT EXISTS(SELECT 1 FROM mutes mu WHERE mu.ownerId=? AND mu.targetId=c.authorId)`;
    let commentAfter = "";
    const commentArgs: unknown[] = [postId, uid, uid, uid];
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
            invitationCommunities: pilotOwner()
              ? [...pilotCommunities, ...(currentCommunity!.dynamic ? [currentCommunity!] : [])]
              : [currentCommunity!],
            invitationCodes: await all<NonNullable<Snapshot["admin"]>["invitationCodes"][number]>(
              "SELECT id,communityId,createdAt,expiresAt,CASE WHEN unlimited=1 THEN NULL ELSE maxUses END maxUses,useCount,revokedAt,label FROM invitation_codes WHERE organizationId IS NULL AND (communityId=? OR ?=1) ORDER BY createdAt DESC,id DESC LIMIT 100", communityId, +pilotOwner(),
            ),
            invitations: await all<
              NonNullable<Snapshot["admin"]>["invitations"][number]
            >(
              "SELECT id,email,expiresAt,usedBy FROM invitations WHERE ?='ithaca' ORDER BY expiresAt DESC LIMIT 100", communityId,
            ),
            questions: await all<Question>(
              "SELECT * FROM questions WHERE ?='ithaca' ORDER BY startsAt DESC LIMIT 100", communityId,
            ),
            reports: await all<
              NonNullable<Snapshot["admin"]>["reports"][number]
            >(
              "SELECT id,reason,status,evidence FROM reports WHERE communityId=? ORDER BY createdAt DESC LIMIT 100", communityId,
            ),
          }
        : undefined;
    const memberOf = (await all<{ communityId: string }>("SELECT communityId FROM pilot_memberships WHERE userId=?", uid)).map((m) => m.communityId);
    const emailCampus = await verifiedCampusFor(identity);
    const locale = localeOf(currentCommunity);
    // A saved discovery city only applies where that city has listings; otherwise
    // each community starts from its own city rather than another's.
    const savedCity = eventPrefs?.city ?? "";
    const discoveryCity =
      !locale || (savedCity && events.some((e) => e.city.toLowerCase() === savedCity.toLowerCase()))
        ? savedCity || locale?.city || currentCommunity!.locationLabel.split(",")[0]
        : locale.city;
    const memberCommunities = (await Promise.all(memberOf.map(communityRecord))).filter(
      (c): c is PilotCommunity => !!c,
    );
    const topics = params.get("commons") || currentNews.length ? await discussionTopics(v) : null;
    return {
      eligibleCommunity: emailCampus && !memberOf.includes(emailCampus.id) ? emailCampus : null,
      unclaimedCampusDomain: emailCampus ? null : verifiedCampusDomain(identity),
      places: currentPlaces,
      commons: topics ? await commonsSummary(v, catalog, topics) : undefined,
      // Ranked with what members here are actually discussing.
      news: rankStories(
        currentNews,
        Object.fromEntries(
          [...(topics ?? new Map())].map(([subjectId, t]): [string, StoryEngagement] => [subjectId, { participants: t.people.size, replies: t.replies, reactions: 0 }]),
        ),
        new Date(),
        localeOf(currentCommunity)?.shortName ?? currentCommunity!.name,
      ).slice(0, 40),
      newsUpdatedAt: (await one<{ importedAt: string }>("SELECT importedAt FROM community_news_imports WHERE communityId=?", communityId))?.importedAt ?? null,
      nationalJoined,
      organizations: await Promise.all(pilotOrganizations.filter(o => o.communityId === communityId).map(async o => ({ ...o, role: (await one<{ role: string }>("SELECT role FROM organization_memberships WHERE userId=? AND organizationId=?", uid, o.id))?.role ?? null }))),
      organizationMembers: orgMembership ? await all("SELECT p.id,p.name,m.role FROM organization_memberships m JOIN profiles p ON p.id=m.userId WHERE m.organizationId=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.ownerId=? AND b.targetId=p.id) OR (b.targetId=? AND b.ownerId=p.id)) ORDER BY p.name", org!.id, uid, uid) : undefined,
      organizationCodes: orgMembership?.role === "organizer" ? await all("SELECT id,expiresAt,useCount,CASE WHEN unlimited=1 THEN NULL ELSE maxUses END maxUses,revokedAt FROM invitation_codes WHERE organizationId=? AND communityId=? ORDER BY createdAt DESC LIMIT 100", org!.id, communityId) : undefined,
      community: currentCommunity!,
      communities: memberCommunities,
      events,
      eventPreferences: eventPrefs
        ? {
            city: discoveryCity,
            interests: JSON.parse(eventPrefs.interestsJson),
            complete: !!eventPrefs.complete,
          }
        : { ...emptySnapshot.eventPreferences, city: discoveryCity },
      eventSuggestions: await all<
        NonNullable<Snapshot["eventSuggestions"]>[number]
      >(
        "SELECT * FROM event_suggestions WHERE (userId=? OR ? IN ('owner','curator')) AND communityId=? ORDER BY createdAt DESC LIMIT 100",
        uid,
        me.role ?? "member",
        communityId,
      ),
      me,
      status: "ready",
      posts: await decorate(rows.slice(0, 20)),
      nextCursor,
      people,
      rankings: ranks.filter((r) => communityId === defaultCommunityId && catalogItem(r.itemId)),
      priorities: (await all<Snapshot["priorities"][number]>(
        "SELECT issueId,priority,note FROM issue_priorities WHERE userId=? ORDER BY priority,issueId",
        uid,
      )).filter((p) => findEntity(p.issueId)?.kind === "issue"),
      follows: follows.filter((f) => !!findEntity(f.issueId) || (communityId === defaultCommunityId && !!issueFor(f.issueId))),
      venuePlans: plans.filter(p => p.userId !== uid && people.some(u => u.id === p.userId && u.relationship === "friends" && !u.blocked && !u.muted) && p.audience !== "only_me" && events.some(e => e.id === p.eventId && e.status === "published" && !eventExpired(e))).map(({ userId, name, eventId, status }) => ({ userId, name, eventId, status })),
      plans: plans.filter(
        (p) =>
          (p.userId === uid || visibleUsers.includes(p.userId)) &&
          ((communityId === defaultCommunityId && !!catalogItem(p.eventId)) || events.some((e) => e.id === p.eventId)),
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
    await resolveCommunity(parsed.data!.communityId);
    if (
      Object.keys((input as { data: Record<string, unknown> }).data).some(
        (k) => !(k in data),
      )
    )
      fail(400, "This submission contains unsupported fields.");
    const now = new Date().toISOString();
    const key = await digest(uid + "|" + requestId);
    const fingerprint = await digest(JSON.stringify(parsed.data!.communityId ? { communityId, data } : data));
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
        `EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (ownerId=? AND targetId=?) OR (ownerId=? AND targetId=?))`,
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
    if (data.action === "account.create") {
      const existing = await one<Person>("SELECT * FROM profiles WHERE id=?", uid);
      // Only a verified sign-in email, never a submitted field, selects a campus.
      // Association is community membership, not student-status verification.
      const campus = await verifiedCampusFor(identity!);
      if (!existing) {
        if (await one("SELECT 1 FROM profiles WHERE username=? AND id<>?", data.username, uid)) fail(409, "That username is taken. Choose another one.");
        add("INSERT INTO profiles(id,name,username,communityLabel,activeCommunityId,createdAt) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", uid, data.name, data.username, campus?.locationLabel ?? "", campus?.id ?? openCommunityId, now);
        add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) VALUES(?,?,?)", uid, openCommunityId, pilotOwner() ? "owner" : "member");
        if (campus)
          add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) SELECT ?,?,'member' WHERE NOT EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", uid, campus.id, uid, campus.id);
        add("INSERT OR IGNORE INTO preferences(userId,replies,reactions,issues,events) VALUES(?,0,0,0,0)", uid);
      }
      // A fresh retry must not overwrite a profile or move an existing member.
      result = { ok: true, alreadyCreated: !!existing, communityId: existing ? undefined : (campus?.id ?? openCommunityId) };
    } else if (data.action === "community.create") {
      if (!(await one("SELECT 1 FROM profiles WHERE id=?", uid))) fail(400, "Create your profile first.");
      const recent = await one<{ n: number }>(
        "SELECT COUNT(*) n FROM place_communities WHERE createdBy=? AND createdAt>?",
        uid,
        new Date(Date.parse(now) - 86400000).toISOString(),
      );
      let target: PilotCommunity | null = null;
      if (data.kind === "campus") {
        // Only the member's own verified institutional domain can found or join a campus.
        const domain = verifiedCampusDomain(identity!);
        if (!domain) fail(403, "Starting a campus community needs a verified university email, which sign-in does not provide yet. Start your town's commons or use an invitation code.");
        const existing = await verifiedCampusFor(identity!);
        if (existing) target = existing;
        else if (!data.university) fail(400, "Enter your university's name.");
      } else {
        // One community per town: reuse a nearby community with the same name.
        const rows = await all<PlaceCommunityRow>(
          "SELECT * FROM place_communities WHERE kind='city' AND status='active' AND lower(city)=lower(?) AND country=? LIMIT 20",
          data.city,
          data.country,
        );
        const near = rows.find((r) => distanceMiles([r.latitude, r.longitude], [data.latitude, data.longitude]) < 25);
        if (near) target = communityFromRow(near);
      }
      let created = false;
      if (!target) {
        if ((recent?.n ?? 0) >= 3) fail(429, "You can start up to three communities a day. Join an existing one or try tomorrow.");
        const slug = (data.kind === "campus" ? data.university! : data.city + " " + data.region)
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40) || "community";
        const newId = "c-" + slug + "-" + key.slice(0, 6);
        const label = [data.city, data.region].filter(Boolean).join(", ");
        const name = data.kind === "campus" ? data.university! : label;
        add(
          "INSERT INTO place_communities(id,kind,name,locationLabel,city,region,country,latitude,longitude,timezone,domain,university,createdBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          newId,
          data.kind,
          name,
          label + (data.country ? ", " + data.country : ""),
          data.city,
          data.region,
          data.country,
          Math.round(data.latitude * 10000) / 10000,
          Math.round(data.longitude * 10000) / 10000,
          data.timezone,
          data.kind === "campus" ? verifiedCampusDomain(identity!) : null,
          data.kind === "campus" ? data.university! : null,
          uid,
          now,
        );
        // The founder can curate listings; moderation stays with the pilot owner.
        add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) VALUES(?,?,?)", uid, newId, pilotOwner() ? "owner" : "curator");
        add("UPDATE profiles SET activeCommunityId=? WHERE id=?", newId, uid);
        result = { ok: true, communityId: newId, created: true };
        created = true;
      }
      if (!created) {
        add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) SELECT ?,?,'member' WHERE NOT EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", uid, target!.id, uid, target!.id);
        add("UPDATE profiles SET activeCommunityId=? WHERE id=?", target!.id, uid);
        result = { ok: true, communityId: target!.id, created: false };
      }
    } else if (data.action === "community.manage") {
      if (!pilotOwner()) fail(403, "Only the configured pilot owner can manage another community.");
      if (!(await communityRecord(data.communityId)) || !await one("SELECT 1 FROM profiles WHERE id=?", uid)) fail(400, "Create your profile and choose an available community.");
      add("INSERT INTO community_memberships(userId,communityId,role) VALUES(?,?,'owner') ON CONFLICT(userId,communityId) DO UPDATE SET role='owner'", uid, data.communityId);
      add("UPDATE profiles SET activeCommunityId=? WHERE id=?", data.communityId, uid);
      for (const org of pilotOrganizations.filter(o => o.communityId === data.communityId))
        add("INSERT INTO organization_memberships(userId,organizationId,role) VALUES(?,?,'organizer') ON CONFLICT(userId,organizationId) DO UPDATE SET role='organizer'", uid, org.id);
      result = { ok: true, communityId: data.communityId };
    } else if (data.action === "invite.redeem" || (data.action === "join" && !!data.invite && !/^[0-9a-f-]{72}$/i.test(data.invite.trim()))) {
      const preview = await previewInvitation(data.invite);
      if (!data.confirmedCommunityId || data.confirmedCommunityId !== preview.community.id)
        fail(400, "Confirm the community associated with this code.");
      const target = preview.community.id;
      const organization = preview.organization;
      const code = await one<{ id: string }>("SELECT id FROM invitation_codes WHERE tokenHash=?", await digest(normalizeCode(data.invite)));
      if (!code) fail(403, "This invitation is unavailable.");
      const existing = await one<Person>("SELECT * FROM profiles WHERE id=?", uid);
      if (!existing && (!data.name || !data.username)) fail(400, "Choose your display name and username to complete your profile.");
      // Every check uses current database time inside the same transactional batch.
      // Already admitted members can safely retry even after a code becomes unusable.
      guard("EXISTS(SELECT 1 FROM invitation_codes WHERE id=? AND communityId=?)", code!.id, target);
      const membershipSql = organization ? "SELECT 1 FROM organization_memberships WHERE userId=? AND organizationId=?" : "SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?";
      const scope = organization?.id ?? target;
      if (organization) {
        if (!await one("SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?", uid, target)) fail(403, "Join this campus using a campus invitation before joining its organization.");
        guard("EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", uid, target);
      }
      guard(`EXISTS(${membershipSql}) OR EXISTS(SELECT 1 FROM invitation_codes WHERE id=? AND revokedAt IS NULL AND (unlimited=1 OR useCount<maxUses) AND expiresAt>strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, uid, scope, code!.id);
      if (!existing) {
        add("INSERT INTO profiles(id,name,username,communityLabel,activeCommunityId,createdAt) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", uid, data.name!, data.username!, preview.community.locationLabel, target, now);
        add("INSERT OR IGNORE INTO preferences(userId,replies,reactions,issues,events) VALUES(?,0,0,0,0)", uid);
      }
      // Count a person once, including retries with new request IDs or devices.
      add(`INSERT OR IGNORE INTO invitation_redemptions(codeId,userId,requestKey,redeemedAt) SELECT ?,?,?,? WHERE NOT EXISTS(${membershipSql})`, code!.id, uid, key, now, uid, scope);
      add("UPDATE invitation_codes SET useCount=useCount+1 WHERE id=? AND EXISTS(SELECT 1 FROM invitation_redemptions WHERE codeId=? AND userId=? AND requestKey=?)", code!.id, code!.id, uid, key);
      if (organization) add("INSERT OR IGNORE INTO organization_memberships(userId,organizationId,role) VALUES(?,?,'member')", uid, organization.id);
      else add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) SELECT ?,?,'member' WHERE NOT EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", uid, target, uid, target);
      add("UPDATE profiles SET activeCommunityId=? WHERE id=?", target, uid);
      result = { ok: true, communityId: target, organizationId: organization?.id, alreadyJoined: preview.alreadyJoined };
    } else if (data.action === "join") {
      if (await one("SELECT 1 FROM pilot_memberships WHERE userId=?", uid))
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
      if (!owner && !invite)
        fail(403, "Use an active invitation code to join your community.");
      communityId = defaultCommunityId;
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
      // Daily questions, legacy email invites and scored rankings use the
      // original Ithaca sample catalog; priorities work wherever issues exist.
      if (
        communityId !== defaultCommunityId &&
        (["invite", "question.save", "answer"].includes(data.action) ||
          data.action.startsWith("ranking") ||
          (!catalog.length && data.action.startsWith("priority.")))
      )
        fail(400, "This community does not have a local issue catalog yet.");
      guard(
        "EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)",
        uid,
        communityId,
      );
      const owner = () => {
        if (m.role !== "owner")
          fail(403, "Community owner access is required.");
        guard(
          "EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=? AND role='owner')",
          uid, communityId,
        );
      };
      const organizer = async (organizationId: string) => {
        const org = organizationFor(organizationId);
        if (org?.communityId !== communityId || !await one("SELECT 1 FROM organization_memberships WHERE userId=? AND organizationId=? AND role='organizer'", uid, organizationId)) fail(403, "Organization organizer access is required.");
        guard("EXISTS(SELECT 1 FROM organization_memberships WHERE userId=? AND organizationId=? AND role='organizer')", uid, organizationId);
      };
      switch (data.action) {
        case "organization.member":
          owner();
          if (organizationFor(data.organizationId)?.communityId !== communityId) fail(404, "Organization unavailable.");
          if (data.role !== "remove") {
            if (!await one("SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?", data.userId, communityId)) fail(403, "This person must first join the campus.");
            guard("EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", data.userId, communityId);
            add("INSERT INTO organization_memberships(userId,organizationId,role) VALUES(?,?,?) ON CONFLICT(userId,organizationId) DO UPDATE SET role=excluded.role", data.userId, data.organizationId, data.role);
          } else add("DELETE FROM organization_memberships WHERE userId=? AND organizationId=?", data.userId, data.organizationId);
          break;
        case "conversation.follow":
          await guardedPost(data.postId);
          add(data.enabled ? "INSERT OR IGNORE INTO conversation_follows(userId,postId) VALUES(?,?)" : "DELETE FROM conversation_follows WHERE userId=? AND postId=?", uid, data.postId);
          break;
        case "conversation.visit":
          await guardedPost(data.postId);
          if (await one("SELECT 1 FROM conversation_follows WHERE userId=? AND postId=?", uid, data.postId))
            add("INSERT OR IGNORE INTO metrics(id,userId,event,objectId,createdAt,communityId) VALUES(?,?,'conversation_return',NULL,?,?)", "return_" + await digest(uid + communityId + now.slice(0, 10)), uid, now.slice(0, 10), communityId);
          break;
        case "community.join": {
          const target = await communityRecord(data.communityId);
          if (!target?.campus && !target?.locality) fail(404, "This community is unavailable.");
          // City and town communities are open to anyone and never assert
          // residence. Campus admission needs a verified university email from
          // an approved sign-in adapter, never location or submitted text.
          if (target!.campus && (await verifiedCampusFor(identity!))?.id !== target!.id)
            fail(403, "Join " + target!.campus!.university + " with a community invitation code. University email verification is not connected yet.");
          add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) SELECT ?,?,'member' WHERE NOT EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", uid, target!.id, uid, target!.id);
          add("UPDATE profiles SET activeCommunityId=? WHERE id=?", target!.id, uid);
          result = { ok: true, communityId: target!.id };
          break;
        }
        case "places.import": {
          if (!localeOf(currentCommunity) || catalog.some((e) => !e.id.startsWith(communityId + ".") && !e.id.startsWith("osm-")))
            fail(400, "This community's map is curated.");
          const row = await one<{ last: string | null }>("SELECT MAX(importedAt) last FROM community_places WHERE communityId=?", communityId);
          if (row?.last && Date.parse(now) - Date.parse(row.last) < 7 * 86400000) {
            result = { ok: true, imported: 0, recent: true };
            break;
          }
          if (!options.fetch) fail(503, "Public place data is not available here.");
          let places: CommunityPlace[] = [];
          try {
            places = await civicPlacesNear(communityId, localeOf(currentCommunity)!.center, options.fetch!, options.contact ?? "polis");
          } catch (e) {
            fail(503, e instanceof Error ? e.message : "Public place data is unavailable right now.");
          }
          for (const p of places)
            add(
              "INSERT INTO community_places(communityId,id,kind,name,subtitle,latitude,longitude,source,sourceRef,website,importedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(communityId,id) DO UPDATE SET kind=excluded.kind,name=excluded.name,subtitle=excluded.subtitle,latitude=excluded.latitude,longitude=excluded.longitude,website=excluded.website,importedAt=excluded.importedAt",
              communityId,
              p.id,
              p.kind,
              p.name,
              p.subtitle,
              p.latitude,
              p.longitude,
              p.source,
              p.sourceRef,
              p.website,
              now,
            );
          add("UPDATE place_communities SET placesImportedAt=? WHERE id=?", now, communityId);
          result = { ok: true, imported: places.length };
          break;
        }
        case "news.import": {
          // Anyone here may refresh, at most every three hours per community.
          const last = await one<{ importedAt: string }>("SELECT importedAt FROM community_news_imports WHERE communityId=?", communityId);
          if (last && Date.parse(now) - Date.parse(last.importedAt) < 3 * 3600000) {
            result = { ok: true, imported: 0, recent: true };
            break;
          }
          if (!newsProfileFor(currentCommunity)) fail(400, "Local news needs a located community.");
          if (!options.fetch) fail(503, "Local news is not available here.");
          const { articles, sources } = await fetchCommunityNews(currentCommunity!, options.fetch!, options.contact ?? "polis");
          if (!sources) fail(503, "Local news sources are unavailable right now. Try again later.");
          for (const a of articles.slice(0, 250))
            add(
              "INSERT INTO community_news(communityId,id,url,title,source,domain,publishedAt,imageUrl,summary,origin,sectionsJson,importedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(communityId,id) DO UPDATE SET title=excluded.title,source=CASE WHEN excluded.origin='local' THEN excluded.source ELSE community_news.source END,imageUrl=COALESCE(excluded.imageUrl,community_news.imageUrl),summary=COALESCE(excluded.summary,community_news.summary),origin=CASE WHEN community_news.origin='local' THEN 'local' ELSE excluded.origin END,sectionsJson=excluded.sectionsJson,importedAt=excluded.importedAt",
              communityId, a.id, a.url, a.title, a.source, a.domain, a.publishedAt, a.imageUrl, a.summary, a.origin, JSON.stringify(a.sections ?? []), now,
            );
          // Headlines older than 30 days are no longer kept.
          add("DELETE FROM community_news WHERE communityId=? AND publishedAt<?", communityId, new Date(Date.parse(now) - 30 * 86400000).toISOString());
          add(
            "INSERT INTO community_news_imports(communityId,importedAt,articles) VALUES(?,?,?) ON CONFLICT(communityId) DO UPDATE SET importedAt=excluded.importedAt,articles=excluded.articles",
            communityId, now, articles.length,
          );
          result = { ok: true, imported: articles.length };
          break;
        }
        case "community.joinNational":
        case "community.joinOpen": {
          add("INSERT OR IGNORE INTO community_memberships(userId,communityId,role) VALUES(?,?,?)", uid, openCommunityId, pilotOwner() ? "owner" : "member");
          if (data.action === "community.joinOpen") add("UPDATE profiles SET activeCommunityId=? WHERE id=?", openCommunityId, uid);
          result = { ok: true, communityId: openCommunityId };
          break;
        }
        case "community.select": {
          if (!(await communityRecord(data.communityId))) fail(404, "This community is unavailable.");
          guard("EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?)", uid, data.communityId);
          if (!(await one("SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=?", uid, data.communityId))) fail(403, "Join this community with an invitation code first.");
          add("UPDATE profiles SET activeCommunityId=? WHERE id=?", data.communityId, uid);
          result = { ok: true, communityId: data.communityId };
          break;
        }
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
            "EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=? AND role IN ('owner','curator'))",
            uid, communityId,
          );
          const e = data.event;
          if (e.campusId && e.campusId !== communityId) fail(400, "Event campus must match the community being curated.");
          if (e.scope === "campus" && e.campusId !== communityId) fail(400, "Select this community as the event campus.");
          if (e.endsAt && e.endsAt <= e.startsAt)
            fail(400, "End time must follow the start.");
          if ((e.latitude === null) !== (e.longitude === null))
            fail(400, "Supply both venue coordinates or neither.");
          if (e.issueId) validSubject(e.issueId);
          if (Date.parse(e.checkedAt) > Date.now() + 60000)
            fail(400, "Source check time cannot be in the future.");
          if (e.id === "community" || topicFor(e.id) || entityFor(e.id) || catalogItem(e.id) || issues.some((i) => i.id === e.id))
            fail(400, "This event ID is reserved.");
          const existing = await eventFor(e.id);
          if (!existing && await one("SELECT 1 FROM community_events WHERE id=?", e.id)) fail(409, "Choose a different event ID.");
          guard("NOT EXISTS(SELECT 1 FROM community_events WHERE id=? AND communityId<>?)", e.id, communityId);
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
            "EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=? AND role IN ('owner','curator'))",
            uid, communityId,
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
            "INSERT INTO event_suggestions(id,userId,title,sourceUrl,note,createdAt,communityId) VALUES(?,?,?,?,?,?,?)",
            objectId,
            uid,
            data.title,
            data.sourceUrl,
            data.note,
            now,
            communityId,
          );
          break;
        case "event.review":
          if (
            !(await one(
              "SELECT 1 FROM event_suggestions WHERE id=? AND communityId=?",
              data.suggestionId, communityId,
            ))
          )
            fail(404, "Suggestion unavailable.");
          if (!["owner", "curator"].includes(m.role))
            fail(403, "Curator access is required.");
          guard(
            "EXISTS(SELECT 1 FROM pilot_memberships WHERE userId=? AND communityId=? AND role IN ('owner','curator'))",
            uid, communityId,
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
          if (data.organizationId) {
            if (organizationFor(data.organizationId)?.communityId !== communityId || !await one("SELECT 1 FROM organization_memberships WHERE userId=? AND organizationId=?", uid, data.organizationId)) fail(403, "Join this organization before posting.");
            guard("EXISTS(SELECT 1 FROM organization_memberships WHERE userId=? AND organizationId=?)", uid, data.organizationId);
            if (data.organizationChannel === "announcements") await organizer(data.organizationId);
          }
          const item = catalogItem(data.subjectId);
          const event = data.subjectId !== "community" && !issueFor(data.subjectId) && !findEntity(data.subjectId) && !entityFor(data.subjectId)
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
          if (data.kind === "update" && !data.sourceUrl) fail(400, "Add a source link for this update.");
          if (data.position && data.kind !== "opinion" && data.kind !== "debate")
            fail(400, "Positions belong to opinion posts.");
          if (data.position && !positionable(data.subjectId))
            fail(400, "Choose an issue, proposal or question for a position.");
          // A titled question or debate can open with its headline alone.
          if (!data.text && !data.position && !(data.title && ["question", "debate"].includes(data.kind)))
            fail(400, "Add a view or a question.");
          if (data.priorPostId) {
            const earlier = await guardedOwnPost(data.priorPostId);
            if (
              earlier.subjectId !== data.subjectId ||
              (earlier.organizationId ?? null) !== data.organizationId ||
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
            { sourceUrl: data.sourceUrl, ...(data.organizationId ? { organizationChannel: data.organizationChannel } : {}) },
            data.priorPostId,
          );
          add("UPDATE posts SET title=?,coverage=? WHERE id=?", data.title, data.coverage, objectId);
          if (data.organizationId) {
            add("UPDATE posts SET organizationId=? WHERE id=?", data.organizationId, objectId);
            add("INSERT INTO metrics(id,userId,event,createdAt,communityId) VALUES(?,?,'organization_contribution',?,?)", key + "_org", uid, now, communityId);
          }

          break;
        }
        case "post.edit": {
          const p = await guardedOwnPost(data.postId);
          if (data.title !== undefined) add("UPDATE posts SET title=? WHERE id=?", data.title, data.postId);
          const attachment = {
            ...JSON.parse(p.attachmentJson || "{}"),
            ...(data.sourceUrl !== undefined
              ? { sourceUrl: data.sourceUrl }
              : {}),
          };
          if (
            (p.kind === "article" || p.kind === "update") &&
            catalogItem(p.subjectId)?.kind !== "News" &&
            !attachment.sourceUrl
          )
            fail(400, "Keep the article’s HTTPS link.");
          if (data.position && ((p.kind !== "opinion" && p.kind !== "debate") || !positionable(p.subjectId)))
            fail(400, "This post does not use a policy position.");
          const title = data.title ?? p.title ?? "";
          if (!data.text && !data.position && !(title && ["question", "debate"].includes(p.kind)))
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
          if (data.position && !replyTakesPosition(p))
            fail(400, "This conversation does not ask for a perspective.");
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
            "INSERT INTO comments(id,postId,authorId,parentId,text,position,createdAt) VALUES(?,?,?,?,?,?,?)",
            objectId,
            p.id,
            uid,
            data.parentId,
            data.text,
            data.position,
            now,
          );
          notify(recipient, "reply", p.id, objectId);
          if (recipient !== p.authorId)
            notify(p.authorId, "reply", p.id, objectId);
          for (const follower of await all<{ userId: string }>("SELECT userId FROM conversation_follows WHERE postId=?", p.id))
            if (follower.userId !== recipient && follower.userId !== p.authorId) notify(follower.userId, "reply", p.id, objectId);
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
          const parentPost = await guardedPost(c!.postId);
          if (c!.authorId !== uid)
            fail(403, "Only the author can change this reply.");
          if (data.action === "comment.edit" && data.position && !replyTakesPosition(parentPost))
            fail(400, "This conversation does not ask for a perspective.");
          if (data.action === "comment.edit")
            add(
              data.position === undefined
                ? "UPDATE comments SET text=?,editedAt=? WHERE id=?"
                : "UPDATE comments SET text=?,editedAt=?,position=? WHERE id=?",
              data.text,
              now,
              ...(data.position === undefined ? [] : [data.position]),
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
          if (communityId !== defaultCommunityId && catalogItem(data.targetId)) fail(404, "This item is not available in this community.");
          if (!catalogItem(data.targetId) && !findEntity(data.targetId)) {
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
          if (findEntity(data.issueId)?.kind !== "issue")
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
          if (ids.some((id) => findEntity(id)?.kind !== "issue"))
            fail(400, "Reorder issues from this community.");
          const placeholders = ids.map(() => "?").join(",");
          // Priorities are ordered within a community. Reject a stale reorder if
          // another tab added or removed one of this community's issues.
          const communityIssues = catalog.filter((e) => e.kind === "issue").map((i) => i.id);
          guard(
            `(SELECT COUNT(*) FROM issue_priorities WHERE userId=? AND issueId IN (${communityIssues.map(() => "?").join(",")}))=? AND (SELECT COUNT(*) FROM issue_priorities WHERE userId=? AND issueId IN (${placeholders}))=?`,
            uid,
            ...communityIssues,
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
          const selected = rows.filter(
            (r) =>
              data.issueIds.includes(r.issueId) &&
              findEntity(r.issueId)?.kind === "issue",
          );
          if (selected.length !== data.issueIds.length)
            fail(400, "Share only your own issue priorities.");
          const items = selected.map((r, index) => ({
            itemId: r.issueId,
            title: findEntity(r.issueId)!.name,
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
          validSubject(data.issueId);
          if (data.issueId === "community") fail(400, "Choose an issue.");
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
          if (communityId !== defaultCommunityId && catalogItem(data.eventId)) fail(404, "This event is not available in this community.");
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
            "INSERT INTO reports(id,reporterId,targetId,reason,evidence,createdAt,communityId) VALUES(?,?,?,?,?,?,?)",
            objectId,
            uid,
            data.targetId,
            data.reason,
            JSON.stringify(evidence),
            now,
            communityId,
          );
          break;
        }
        case "invite.code": {
          if (data.organizationId) await organizer(data.organizationId); else owner();
          const target = data.communityId ?? communityId;
          if (!(await communityRecord(target))) fail(400, "Choose an available university or community.");
          if (target !== communityId && !pilotOwner()) fail(403, "You can only invite people to your own community.");
          if (data.organizationId && organizationFor(data.organizationId)?.communityId !== target) fail(400, "Organization and campus must match.");
          let token: string;
          let label: string | null = null;
          if (data.code) {
            // Memorable codes are shareable by design; they rely on usage limits,
            // expiration and deactivation rather than secrecy.
            const normalized = normalizeCode(data.code);
            if (!/^[A-Z0-9]{6,32}$/.test(normalized))
              fail(400, "Use 6–32 letters or numbers for a custom code. Spaces and hyphens are ignored.");
            if (await one("SELECT 1 FROM invitation_codes WHERE tokenHash=?", await digest(normalized)))
              fail(409, "That code is already in use. Choose another.");
            token = data.code.trim().toUpperCase().replace(/\s+/g, "-");
            label = token;
          } else {
            // Twelve uniformly sampled base32 characters give 60 bits of entropy.
            const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
            const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => alphabet[byte % 32]).join("");
            token = "POLIS-" + code.match(/.{4}/g)!.join("-");
          }
          add("INSERT INTO invitation_codes(id,tokenHash,createdBy,createdAt,expiresAt,maxUses,communityId,unlimited,label) VALUES(?,?,?,?,?,?,?,?,?)",
            objectId, await digest(normalizeCode(token)), uid, now,
            data.expiresDays === null ? NO_EXPIRY : new Date(Date.parse(now) + data.expiresDays * 86400000).toISOString(), data.maxUses ?? 1, target, +(data.maxUses === null), label);
          result = { ok: true, invitationCode: token };
          if (data.organizationId) add("UPDATE invitation_codes SET organizationId=? WHERE id=?", data.organizationId, objectId);
          break;
        }
        case "invite.reactivate": {
          const code = await one<{ organizationId: string | null }>("SELECT organizationId FROM invitation_codes WHERE id=?", data.codeId);
          if (code?.organizationId) await organizer(code.organizationId); else owner();
          if (!(await one("SELECT id FROM invitation_codes WHERE id=? AND (communityId=? OR ?=1)", data.codeId, communityId, +pilotOwner()))) fail(404, "Invitation code unavailable.");
          add("UPDATE invitation_codes SET revokedAt=NULL WHERE id=? AND (communityId=? OR ?=1)", data.codeId, communityId, +pilotOwner());
          break;
        }
        case "invite.revoke": {
          const code = await one<{ organizationId: string | null }>("SELECT organizationId FROM invitation_codes WHERE id=?", data.codeId);
          if (code?.organizationId) await organizer(code.organizationId); else owner();
          if (!(await one("SELECT id FROM invitation_codes WHERE id=? AND (communityId=? OR ?=1)", data.codeId, communityId, +pilotOwner()))) fail(404, "Invitation code unavailable.");
          add("UPDATE invitation_codes SET revokedAt=COALESCE(revokedAt,?) WHERE id=? AND (communityId=? OR ?=1)", now, data.codeId, communityId, +pilotOwner());
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
          validSubject(data.issueId);
          if (data.issueId === "community") fail(400, "Choose an issue.");
          add(
            "INSERT INTO issue_updates(id,issueId,title,sourceUrl,sample,createdAt,communityId) VALUES(?,?,?,?,?,?,?)",
            objectId,
            data.issueId,
            data.title,
            data.sourceUrl,
            +data.sample,
            now,
            communityId,
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
              "SELECT targetId FROM reports WHERE id=? AND communityId=?",
              data.reportId, communityId,
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
            "INSERT OR IGNORE INTO metrics(id,userId,event,createdAt,communityId) VALUES(?,?,?,?,?)",
            uid + "_" + communityId + "_" + now.slice(0, 10),
            uid,
            "active_day",
            now,
            communityId,
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
    // Scope minimal first-party measures without copying text or political positions.
    add("UPDATE metrics SET communityId=? WHERE id IN (?, ?, ?)", communityId, key + "_post", key + "_reply", key + "_event");
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
            (await digest(JSON.stringify(parsed.data.communityId ? { communityId: parsed.data.communityId, data: parsed.data.data } : parsed.data.data)))
          )
            fail(409, "This submission key was already used.");
          return JSON.parse(saved.resultJson);
        }
      }
      throw error;
    }
  }
  // Communities anyone signed in can find: configured campuses and communities
  // members started, by name or near a point, with member counts.
  async function searchCommunities(query: string, near: [number, number] | null): Promise<CommunitySearchResult[]> {
    if (!identity) fail(401, "Sign in to continue.");
    const q = query.trim().toLowerCase().slice(0, 80);
    const configured = pilotCommunities.filter(
      (c) => c.campus && (!q || (c.name + " " + c.locationLabel + " " + c.campus.university).toLowerCase().includes(q)),
    );
    const rows = q
      ? await all<PlaceCommunityRow>(
          "SELECT * FROM place_communities WHERE status='active' AND (instr(lower(name),?)>0 OR instr(lower(city),?)>0 OR instr(lower(COALESCE(university,'')),?)>0 OR domain=?) LIMIT 40",
          q,
          q,
          q,
          q,
        )
      : near
        ? await all<PlaceCommunityRow>(
            "SELECT * FROM place_communities WHERE status='active' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? LIMIT 200",
            near[0] - 1,
            near[0] + 1,
            near[1] - 1.5,
            near[1] + 1.5,
          )
        : await all<PlaceCommunityRow>("SELECT * FROM place_communities WHERE status='active' ORDER BY createdAt DESC LIMIT 20");
    const list = [...configured, ...rows.map(communityFromRow)];
    if (!list.length) return [];
    const counts = await all<{ communityId: string; n: number }>(
      `SELECT communityId,COUNT(*) n FROM pilot_memberships WHERE communityId IN (${list.map(() => "?").join(",")}) GROUP BY communityId`,
      ...list.map((c) => c.id),
    );
    return list
      .map((community) => {
        const center = localeOf(community)?.center;
        return {
          community,
          members: counts.find((c) => c.communityId === community.id)?.n ?? 0,
          miles: near && center ? Math.round(distanceMiles(near, center) * 10) / 10 : null,
        };
      })
      .filter((r) => q || !near || (r.miles ?? 0) < 60)
      .sort((a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9) || b.members - a.members)
      .slice(0, 12);
  }
  async function lookupPlaces(query: string) {
    if (!identity) fail(401, "Sign in to continue.");
    if (!options.fetch) fail(503, "Place search is not available here.");
    await placeLookupSlot();
    return searchPlaces(query, options.fetch!, options.contact ?? "polis");
  }
  async function lookupReverse(latitude: number, longitude: number) {
    if (!identity) fail(401, "Sign in to continue.");
    if (!options.fetch) fail(503, "Place search is not available here.");
    if (!(Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180)) fail(400, "Invalid location.");
    await placeLookupSlot();
    return reversePlace(latitude, longitude, options.fetch!, options.contact ?? "polis");
  }
  return { snapshot, execute, previewInvitation, searchCommunities, lookupPlaces, lookupReverse };
}
