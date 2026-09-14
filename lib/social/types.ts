export type Audience = "only_me" | "friends" | "community";
export type PostType =
  | "opinion"
  | "question"
  | "article"
  | "ranking"
  | "event_reflection"
  | "event_plan";
export type Position =
  "support" | "reservations" | "mixed" | "oppose" | "learning";
export type EventPlanStatus = "interested" | "attending";
export type PlanConfirmation = {
  userId: string;
  eventId: string;
  status: EventPlanStatus | null;
  audience: Audience;
};
export type CommandResult = {
  ok: boolean;
  postId?: string;
  commentId?: string;
  invite?: string;
  plan?: PlanConfirmation;
};
export const audiences: Record<Audience, string> = {
  only_me: "Only me",
  friends: "Friends",
  community: "Community",
};
export const positions: Record<Position, string> = {
  support: "Support",
  reservations: "Support with reservations",
  mixed: "Mixed",
  oppose: "Oppose",
  learning: "Still learning",
};
export type Person = {
  id: string;
  name: string;
  username: string;
  bio: string;
  communityLabel: string;
  role?: string;
  relationship?: string;
  muted?: boolean;
  blocked?: boolean;
};
export type Rank = {
  itemId: string;
  score: number;
  note: string;
  priority: number;
  position: Position | null;
};
export type Post = {
  id: string;
  authorId: string;
  name: string;
  username: string;
  kind: PostType;
  subjectId: string;
  issueId: string;
  position: Position | null;
  text: string;
  audience: Audience;
  attachmentJson: string;
  priorPostId: string | null;
  createdAt: string;
  editedAt: string | null;
  reactions: { kind: string; count: number }[];
  myReaction: string | null;
  replyCount: number;
  saved: boolean;
};
export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  name: string;
  parentId: string | null;
  text: string;
  createdAt: string;
  editedAt: string | null;
};
export type Notice = {
  id: string;
  kind: string;
  name: string;
  targetId: string;
  commentId: string | null;
  createdAt: string;
  readAt: string | null;
};
export type Question = {
  id: string;
  issueId: string;
  title: string;
  background: string;
  sourceUrl: string;
  sample: number;
  optionsJson: string;
  startsAt: string;
  endsAt: string;
  status: string;
  counts?: { choice: string; count: number }[];
};
export type Snapshot = {
  me: Person | null;
  status: "signed_out" | "onboarding" | "ready";
  posts: Post[];
  nextCursor: string | null;
  people: Person[];
  rankings: Rank[];
  follows: { issueId: string; notify: number }[];
  plans: {
    userId: string;
    name: string;
    eventId: string;
    status: EventPlanStatus;
    audience: Audience;
  }[];
  saved: string[];
  notifications: Notice[];
  question: Question | null;
  answer: { choice: string; note: string; audience: Audience } | null;
  preferences: {
    replies: number;
    reactions: number;
    issues: number;
    events: number;
  };
  updates: {
    id: string;
    issueId: string;
    title: string;
    sourceUrl: string;
    sample: number;
    createdAt: string;
  }[];
  comments?: Comment[];
  nextCommentCursor?: string | null;
  lists?: {
    id: string;
    postId: string;
    userId: string;
    title: string;
    itemsJson: string;
    name: string;
  }[];
  admin?: {
    invitations: {
      id: string;
      email: string;
      expiresAt: string;
      usedBy: string | null;
    }[];
    questions: Question[];
    reports: { id: string; reason: string; status: string; evidence: string }[];
  };
};
export const emptySnapshot: Snapshot = {
  me: null,
  status: "signed_out",
  posts: [],
  nextCursor: null,
  people: [],
  rankings: [],
  follows: [],
  plans: [],
  saved: [],
  notifications: [],
  question: null,
  answer: null,
  preferences: { replies: 1, reactions: 1, issues: 1, events: 0 },
  updates: [],
};
