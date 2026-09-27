import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
  check,
  sqliteView,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text().primaryKey(),
  name: text().notNull(),
  username: text().notNull().unique(),
  bio: text().notNull().default(""),
  communityLabel: text().notNull().default("Ithaca, NY"),
  createdAt: text().notNull(),
  onboardingComplete: integer().notNull().default(0),
  activeCommunityId: text().notNull().default("ithaca"),
});
export const memberships = sqliteTable("memberships", {
  userId: text()
    .primaryKey()
    .references(() => profiles.id),
  communityId: text().notNull(),
  role: text().notNull().default("member"),
});
export const invitations = sqliteTable("invitations", {
  id: text().primaryKey(),
  email: text().notNull(),
  tokenHash: text().notNull().unique(),
  createdBy: text().notNull(),
  expiresAt: text().notNull(),
  usedBy: text(),
});
// Preserve legacy memberships in place. New memberships use a composite key.
export const communityMemberships = sqliteTable("community_memberships", {
  userId: text().notNull().references(() => profiles.id),
  communityId: text().notNull(),
  role: text().notNull().default("member"),
}, t => [primaryKey({ columns: [t.userId, t.communityId] })]);
export const pilotMemberships = sqliteView("pilot_memberships", {
  userId: text().notNull(), communityId: text().notNull(), role: text().notNull(),
}).as(sql`SELECT userId,communityId,role FROM memberships UNION ALL SELECT c.userId,c.communityId,c.role FROM community_memberships c WHERE NOT EXISTS(SELECT 1 FROM memberships m WHERE m.userId=c.userId AND m.communityId=c.communityId)`);
export const invitationCodes = sqliteTable("invitation_codes", {
  id: text().primaryKey(),
  tokenHash: text().notNull().unique(),
  createdBy: text().notNull(),
  createdAt: text().notNull(),
  expiresAt: text().notNull(),
  maxUses: integer().notNull(),
  useCount: integer().notNull().default(0),
  revokedAt: text(),
  communityId: text().notNull().default("ithaca"),
  unlimited: integer().notNull().default(0),
  organizationId: text(),
  // Owner-chosen memorable codes are meant to be shared, so their text can be
  // listed for administrators. Generated secret codes keep this empty.
  label: text(),
});
export const invitationRedemptions = sqliteTable("invitation_redemptions", {
  codeId: text().notNull().references(() => invitationCodes.id),
  userId: text().notNull().references(() => profiles.id),
  requestKey: text().notNull(),
  redeemedAt: text().notNull(),
}, t => [primaryKey({ columns: [t.codeId, t.userId] })]);
export const friendships = sqliteTable(
  "friendships",
  {
    id: text().primaryKey(),
    a: text().notNull(),
    b: text().notNull(),
    requester: text().notNull(),
    status: text().notNull(),
  },
  (t) => [uniqueIndex("friend_pair").on(t.a, t.b)],
);
export const blocks = sqliteTable(
  "blocks",
  { ownerId: text().notNull(), targetId: text().notNull() },
  (t) => [primaryKey({ columns: [t.ownerId, t.targetId] })],
);
export const mutes = sqliteTable(
  "mutes",
  { ownerId: text().notNull(), targetId: text().notNull() },
  (t) => [primaryKey({ columns: [t.ownerId, t.targetId] })],
);
export const posts = sqliteTable(
  "posts",
  {
    id: text().primaryKey(),
    authorId: text()
      .notNull()
      .references(() => profiles.id),
    communityId: text().notNull(),
    organizationId: text(),
    title: text().notNull().default(""),
    coverage: text().notNull().default("local"),
    kind: text().notNull(),
    subjectId: text().notNull(),
    issueId: text().notNull(),
    position: text(),
    text: text().notNull(),
    audience: text().notNull(),
    attachmentJson: text().notNull().default("{}"),
    priorPostId: text(),
    createdAt: text().notNull(),
    editedAt: text(),
    deletedAt: text(),
  },
  (t) => [index("posts_feed").on(t.communityId, t.createdAt, t.id)],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text().primaryKey(),
    postId: text()
      .notNull()
      .references(() => posts.id),
    authorId: text()
      .notNull()
      .references(() => profiles.id),
    parentId: text(),
    text: text().notNull(),
    // Optional perspective on the conversation's question. Null for replies
    // that simply respond; never inferred.
    position: text(),
    createdAt: text().notNull(),
    editedAt: text(),
    deletedAt: text(),
  },
  (t) => [index("comments_post").on(t.postId, t.createdAt)],
);
export const reactions = sqliteTable(
  "reactions",
  {
    userId: text().notNull(),
    postId: text()
      .notNull()
      .references(() => posts.id),
    kind: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);
export const saves = sqliteTable(
  "saves",
  { userId: text().notNull(), targetId: text().notNull() },
  (t) => [primaryKey({ columns: [t.userId, t.targetId] })],
);
export const rankings = sqliteTable(
  "rankings",
  {
    userId: text().notNull(),
    itemId: text().notNull(),
    score: real().notNull(),
    note: text().notNull(),
    priority: integer().notNull(),
    position: text(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);
export const issuePriorities = sqliteTable(
  "issue_priorities",
  {
    userId: text()
      .notNull()
      .references(() => profiles.id),
    issueId: text().notNull(),
    priority: integer().notNull(),
    note: text().notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.userId, t.issueId] })],
);
export const lists = sqliteTable("lists", {
  id: text().primaryKey(),
  postId: text()
    .notNull()
    .unique()
    .references(() => posts.id),
  userId: text().notNull(),
  title: text().notNull(),
  itemsJson: text().notNull(),
});
export const follows = sqliteTable(
  "follows",
  {
    userId: text().notNull(),
    issueId: text().notNull(),
    notify: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.issueId] })],
);
export const conversationFollows = sqliteTable("conversation_follows", {
  userId: text().notNull().references(() => profiles.id),
  postId: text().notNull().references(() => posts.id),
}, t => [primaryKey({ columns: [t.userId, t.postId] })]);
export const organizationMemberships = sqliteTable("organization_memberships", {
  userId: text().notNull().references(() => profiles.id),
  organizationId: text().notNull(),
  role: text().notNull().default("member"),
}, t => [primaryKey({ columns: [t.userId, t.organizationId] })]);
export const plans = sqliteTable(
  "plans",
  {
    userId: text().notNull(),
    eventId: text().notNull(),
    status: text().notNull(),
    audience: text().notNull().default("only_me"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);
export const eventSeries = sqliteTable("event_series", {
  id: text().primaryKey(),
  title: text().notNull(),
});
export const communityEvents = sqliteTable(
  "community_events",
  {
    id: text().primaryKey(),
    seriesId: text()
      .notNull()
      .references(() => eventSeries.id),
    communityId: text().notNull(),
    recordJson: text().notNull(),
    startsAt: text().notNull(),
    endsAt: text(),
    status: text().notNull(),
    createdBy: text()
      .notNull()
      .references(() => profiles.id),
    updatedAt: text().notNull(),
  },
  (t) => [
    index("events_upcoming").on(t.communityId, t.status, t.startsAt),
    uniqueIndex("event_series_occurrence").on(t.seriesId, t.startsAt),
  ],
);
export const eventPreferences = sqliteTable("event_preferences", {
  userId: text()
    .primaryKey()
    .references(() => profiles.id),
  city: text().notNull().default("Ithaca"),
  interestsJson: text().notNull().default("[]"),
  complete: integer().notNull().default(0),
});
export const eventSuggestions = sqliteTable("event_suggestions", {
  id: text().primaryKey(),
  communityId: text().notNull().default("ithaca"),
  userId: text()
    .notNull()
    .references(() => profiles.id),
  title: text().notNull(),
  sourceUrl: text().notNull(),
  note: text().notNull(),
  status: text().notNull().default("pending"),
  createdAt: text().notNull(),
});
export const questions = sqliteTable("questions", {
  id: text().primaryKey(),
  issueId: text().notNull(),
  title: text().notNull(),
  background: text().notNull(),
  sourceUrl: text().notNull(),
  sample: integer().notNull().default(1),
  optionsJson: text().notNull(),
  startsAt: text().notNull(),
  endsAt: text().notNull(),
  status: text().notNull(),
});
export const answers = sqliteTable(
  "answers",
  {
    userId: text().notNull(),
    questionId: text().notNull(),
    choice: text().notNull(),
    note: text().notNull(),
    audience: text().notNull().default("only_me"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] })],
);
export const issueUpdates = sqliteTable("issue_updates", {
  id: text().primaryKey(),
  communityId: text().notNull().default("ithaca"),
  issueId: text().notNull(),
  title: text().notNull(),
  sourceUrl: text().notNull(),
  sample: integer().notNull(),
  createdAt: text().notNull(),
});
export const notifications = sqliteTable(
  "notifications",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    actorId: text().notNull(),
    kind: text().notNull(),
    targetId: text().notNull(),
    commentId: text(),
    createdAt: text().notNull(),
    readAt: text(),
  },
  (t) => [index("notification_inbox").on(t.userId, t.createdAt)],
);
export const preferences = sqliteTable("preferences", {
  userId: text().primaryKey(),
  replies: integer().notNull().default(1),
  reactions: integer().notNull().default(1),
  issues: integer().notNull().default(1),
  events: integer().notNull().default(0),
});
export const reports = sqliteTable("reports", {
  id: text().primaryKey(),
  communityId: text().notNull().default("ithaca"),
  reporterId: text().notNull(),
  targetId: text().notNull(),
  reason: text().notNull(),
  evidence: text().notNull(),
  status: text().notNull().default("open"),
  createdAt: text().notNull(),
});
export const requests = sqliteTable("requests", {
  id: text().primaryKey(),
  userId: text().notNull(),
  fingerprint: text().notNull(),
  resultJson: text().notNull(),
  createdAt: text().notNull(),
});
export const metrics = sqliteTable("metrics", {
  id: text().primaryKey(),
  communityId: text().notNull().default("ithaca"),
  userId: text().notNull(),
  event: text().notNull(),
  objectId: text(),
  createdAt: text().notNull(),
});

export const writeGuards = sqliteTable(
  "write_guards",
  { id: text().primaryKey(), allowed: integer().notNull() },
  (t) => [check("write_allowed", sql`${t.allowed}=1`)],
);
