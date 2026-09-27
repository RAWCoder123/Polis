import type { PilotCommunity } from "./communities";
export type InvitationPreview = { community: PilotCommunity; organization?: { id: string; name: string }; expiresAt: string; alreadyJoined: boolean };
export type Audience = "only_me" | "friends" | "community";
export type PostType =
  | "opinion"
  | "question"
  | "debate"
  | "update"
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
  | "civic_meetings"
  | "campus_life"
  | "music"
  | "sports"
  | "community"
  | "politics";
export type CommunityEvent = {
  campusId?: string;
  organizationName?: string;
  scope?: "campus" | "town";
  imageAlt?: string;
  imageCredit?: string;
  imageSourceUrl?: string;
  imageNote?: string;

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
  communityId?: string;
  alreadyJoined?: boolean;
  organizationId?: string;
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
  activeCommunityId?: string;
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
  communityId: string;
  organizationId?: string | null;
  title?: string;
  coverage?: "local" | "national";
  activitySort?: string;
  following?: boolean;
  latestActivity?: string;
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
  // Distinct people visible to the viewer: the author plus reply authors.
  participantCount: number;
  saved: boolean;
};
export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  name: string;
  parentId: string | null;
  text: string;
  position: Position | null;
  createdAt: string;
  editedAt: string | null;
};
export type Notice = {
  communityId?: string;
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
// A university pilot site. Adding a campus is configuration, not new pages.
export type Campus = {
  university: string;
  shortName: string;
  // Sign-in email domains associated with this campus community. Exact matches
  // only; an empty list keeps the campus invitation-only.
  domains: string[];
  city: string;
  state: string;
  center: [number, number];
  zoom: number;
  timezone: string;
  // Small brand marks only; the Polis cobalt remains the interface color.
  accent: string;
  monogram: string;
  // Reserved for a later approved campus SSO/SAML integration. Unused today.
  sso?: { protocol: "saml" | "oidc"; metadataUrl: string };
};
export type EntityKind =
  | "official"
  | "institution"
  | "building"
  | "organization"
  | "place"
  | "issue"
  | "policy"
  | "project"
  | "news"
  | "meeting"
  | "elections"
  | "question";
export type EntityScope = "campus" | "local" | "national";
export type EntityLink = { title: string; url: string };
// Code-defined civic context for a community. `sample` marks illustrative
// content; unsampled records only state what an office or place is.
export type CivicEntity = {
  id: string;
  communityId: string;
  kind: EntityKind;
  name: string;
  subtitle: string;
  summary: string;
  details?: string[];
  scope: EntityScope;
  topics: string[];
  related: string[];
  location?: { lat: number; lng: number; label: string; approximate?: boolean };
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageSourceUrl?: string;
  imagePosition?: string;
  checkedAt?: string;
  monogram?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sample: boolean;
  // Manually checked source background for a sourced Commons topic.
  background?: {
    text: string;
    documentTitle: string;
    url: string;
    publisher: string;
    sourceDate: string | null;
    checkedAt: string;
  };
  office?: {
    title: string;
    jurisdiction: string;
    // Only when supplied from a checked source; never inferred.
    officeholder?: string;
    party?: string;
    directoryUrl?: string;
  };
  policy?: {
    status: string;
    category: string;
    institutionId?: string;
    steps: { when: string; label: string }[];
    documents: EntityLink[];
  };
  news?: { source: string; publishedAt: string; url?: string };
  meeting?: { schedule: string; bodyId?: string; calendarUrl?: string };
  debate?: {
    // Open-ended questions collect ideas rather than support or opposition.
    openEnded?: boolean;
    context: string;
    perspectives: { label: string; points: string[] }[];
    documents: EntityLink[];
    openedAt: string;
  };
};
export type CommonsSummary = {
  // Subjects with the most distinct participants in the recent window.
  topics: { subjectId: string; posts: number; replies: number; participants: number }[];
  // Structured questions: visible responses and each person's latest perspective.
  questions: {
    id: string;
    responses: number;
    participants: number;
    positions: { position: string; count: number }[];
  }[];
};
export type Snapshot = {
  // A campus the signed-in email domain is associated with but not joined yet.
  eligibleCommunity?: PilotCommunity | null;
  commons?: CommonsSummary;
  nationalJoined?: boolean;
  organizations?: { id: string; name: string; description: string; role: string | null }[];
  organizationMembers?: { id: string; name: string; role: string }[];
  organizationCodes?: { id: string; expiresAt: string; useCount: number; maxUses: number | null; revokedAt: string | null }[];
  community: PilotCommunity | null;
  communities: PilotCommunity[];
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
  venuePlans?: { userId: string; name: string; eventId: string; status: EventPlanStatus }[];
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
    invitationCommunities: PilotCommunity[];
    invitationCodes: { id: string; communityId: string; createdAt: string; expiresAt: string; maxUses: number | null; useCount: number; revokedAt: string | null; label: string | null }[];
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
  community: null,
  communities: [],
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
