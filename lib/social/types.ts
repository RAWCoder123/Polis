export type Audience = "only_me" | "friends" | "community";
export type PostType =
  | "opinion"
  | "question"
  | "article"
  | "ranking"
  | "event_share"
  | "event_reflection"
  | "event_plan";
export type Position =
  "support" | "reservations" | "mixed" | "oppose" | "learning";
export type EventPlanStatus = "interested" | "attending";
export type EventCategory =
  | "food_markets"
  | "arts_culture"
  | "festivals_parades"
  | "outdoors"
  | "volunteering"
  | "civic_meetings";
export type CommunityEvent = {
  id: string;
  seriesId: string;
  title: string;
  description: string;
  organizer: string;
  sourceUrl: string;
  checkedAt: string;
  venue: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  category: EventCategory;
  cost: "free" | "paid" | "unknown";
  costDetails: string;
  accessibility: string;
  registration: string;
  registrationUrl: string;
  issueId: string;
  status: "draft" | "published" | "canceled" | "archived";
  sample: boolean;
};
export type EventPreferences = {
  city: string;
  interests: EventCategory[];
  complete: boolean;
};
export type EventSuggestion = {
  id: string;
  userId: string;
  title: string;
  sourceUrl: string;
  note: string;
  status: string;
  createdAt: string;
};
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
  invitationCode?: string;
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
  onboardingComplete?: number;
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
  events: CommunityEvent[];
  eventPreferences: EventPreferences;
  eventSuggestions?: EventSuggestion[];
  me: Person | null;
  status: "signed_out" | "onboarding" | "ready";
  posts: Post[];
  nextCursor: string | null;
  people: Person[];
  rankings: Rank[];
  priorities: { issueId: string; priority: number; note: string }[];
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
  commentUnavailable?: boolean;
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
    invitationCodes: { id: string; createdAt: string; expiresAt: string; maxUses: number; useCount: number; revokedAt: string | null }[];
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
  events: [],
  eventPreferences: { city: "Ithaca", interests: [], complete: false },
  me: null,
  status: "signed_out",
  posts: [],
  nextCursor: null,
  people: [],
  rankings: [],
  priorities: [],
  follows: [],
  plans: [],
  saved: [],
  notifications: [],
  question: null,
  answer: null,
  preferences: { replies: 1, reactions: 1, issues: 1, events: 0 },
  updates: [],
};
