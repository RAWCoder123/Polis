import type { CivicEntity, CommunityEvent, CommunityPlace, EntityKind, Snapshot } from "../types.ts";
import type { PilotCommunity } from "../communities.ts";
import { genericCatalog } from "./generic.ts";
import { distanceMiles, eventExpired } from "../events.ts";
import { itemById } from "../../polis-data.ts";
import { issues as legacyIssues } from "../catalog.ts";
import { commonsTopics } from "../commons.ts";
import { cornellEntities } from "./cornell.ts";
import { verifiedNews } from "./verified-news.ts";
import { verifiedPeople } from "./verified-people.ts";
import { explainers, localDecisionsGuide } from "./explainers.ts";
import { newsCategories, type NewsStory, type RankedStory } from "../local-news.ts";
import { ufEntities } from "./uf.ts";

// The manually checked Commons topics are first-class issues: their sourced
// background stays separate from member perspectives on the topic page.
const topicScope: Record<string, CivicEntity["scope"]> = {
  "cornell-transit": "local",
  "cornell-climate": "campus",
  "uf-transit": "local",
  "uf-climate": "campus",
};
const sourcedTopics: CivicEntity[] = commonsTopics.map((t) => ({
  id: t.id,
  communityId: t.communityId,
  kind: "issue",
  name: t.name,
  subtitle: "Sourced topic · " + t.publisher,
  summary: t.description,
  scope: topicScope[t.id] ?? "local",
  topics: [],
  related: [],
  sourceUrl: t.source,
  sourceLabel: t.publisher,
  sample: false,
  background: {
    text: t.update,
    documentTitle: t.documentTitle,
    url: t.source,
    publisher: t.publisher,
    sourceDate: t.sourceDate,
    checkedAt: t.checkedAt,
  },
}));

// One reusable civic catalog keyed by community. Pages never branch on a
// specific campus; they ask for the current community's entities.
export const civicEntities: CivicEntity[] = [
  ...verifiedNews,
  ...verifiedPeople,
  ...sourcedTopics,
  ...cornellEntities,
  ...ufEntities,
  localDecisionsGuide("ithaca", "Ithaca", "Common Council", true),
  localDecisionsGuide("uf", "Gainesville", "City Commission", true),
].map((e) => (explainers[e.id] ? { ...e, explainer: explainers[e.id] } : e));
const byId = new Map(civicEntities.map((e) => [e.id, e]));
export const entityFor = (id: string) => (byId.has(id) ? byId.get(id) : undefined);
export const entitiesFor = (communityId: string) =>
  civicEntities.filter((e) => e.communityId === communityId);
export function entityIn(communityId: string, id: string) {
  const e = entityFor(id);
  return e && e.communityId === communityId ? e : undefined;
}
export const issuesIn = (communityId: string) =>
  entitiesFor(communityId).filter((e) => e.kind === "issue");
export const hasCatalog = (communityId: string) =>
  civicEntities.some((e) => e.communityId === communityId);
// The issue a conversation about this entity belongs to.
export const topicFor = (e: CivicEntity) =>
  e.kind === "issue" ? e.id : (e.topics[0] ?? "");
// Subjects where "support / oppose / still learning" is a meaningful answer.
export const takesPosition = (e: CivicEntity) =>
  e.kind === "issue" ||
  e.kind === "policy" ||
  e.kind === "project" ||
  (e.kind === "question" && !e.debate?.openEnded);

// Shared by the composer and the service. The original Ithaca sample policies
// and issues keep accepting positions in the Cornell community.
export function subjectTakesPosition(catalog: CivicEntity[], communityId: string, subjectId: string) {
  const e = inCatalog(catalog, subjectId);
  if (e) return takesPosition(e);
  return (
    communityId === "ithaca" &&
    ((Object.hasOwn(itemById, subjectId) && itemById[subjectId].kind === "Policies") ||
      legacyIssues.some((i) => i.id === subjectId))
  );
}
// Replies may state a perspective when the conversation asks a question or
// concerns a subject where support and opposition are meaningful.
export function replyTakesPosition(catalog: CivicEntity[], communityId: string, post: { kind: string; subjectId: string }) {
  return ["question", "debate"].includes(post.kind)
    ? !inCatalog(catalog, post.subjectId)?.debate?.openEnded
    : subjectTakesPosition(catalog, communityId, post.subjectId);
}
// The civic catalog for any community: curated where it exists (Cornell, UF),
// otherwise a generated scaffold plus imported public places.
export function catalogFor(community: PilotCommunity | null | undefined, places: CommunityPlace[] = [], news: (NewsStory | RankedStory)[] = []) {
  if (!community) return [];
  const curated = entitiesFor(community.id);
  return [...(curated.length ? curated : genericCatalog(community, places)), ...news.map((s) => newsEntity(s, community.id))];
}
// A local news story as a subject people can open, follow and discuss.
export function newsEntity(s: NewsStory | RankedStory, communityId: string): CivicEntity {
  const story: RankedStory = "reasons" in s ? s : { ...s, score: 0, discussing: 0, reasons: [] };
  return {
    id: s.id,
    communityId,
    kind: "news",
    name: s.title,
    subtitle: s.source + " · " + (s.opinion ? "Opinion" : newsCategories[s.category].label),
    summary: s.summary ?? (s.outlets > 1 ? "Reported by " + s.outlets + " outlets." : "Reported by " + s.source + "."),
    scope: "local",
    topics: [],
    related: [],
    sample: false,
    news: { source: s.source, publishedAt: s.publishedAt, url: s.url },
    sourceUrl: s.url,
    sourceLabel: "Read at " + s.source,
    aliases: s.articles.map((a) => a.id).filter((id) => id !== s.id),
    story,
  };
}
export const inCatalog = (catalog: CivicEntity[], id: string) => catalog.find((e) => e.id === id || !!e.aliases?.includes(id));
// Client convenience: one catalog per snapshot object.
const snapshotCatalogs = new WeakMap<Snapshot, CivicEntity[]>();
export function catalogOf(data: Snapshot) {
  let catalog = snapshotCatalogs.get(data);
  if (!catalog) {
    catalog = catalogFor(data.community, data.places ?? [], data.news ?? []);
    snapshotCatalogs.set(data, catalog);
  }
  return catalog;
}
export const entityKinds: Record<EntityKind, { label: string; plural: string }> = {
  official: { label: "Public office", plural: "People & offices" },
  institution: { label: "Institution", plural: "Institutions" },
  building: { label: "Campus building", plural: "Campus buildings" },
  organization: { label: "Organization", plural: "Organizations" },
  place: { label: "Place", plural: "Places" },
  issue: { label: "Issue", plural: "Issues" },
  policy: { label: "Proposal", plural: "Policies & proposals" },
  project: { label: "Project", plural: "Projects" },
  news: { label: "News", plural: "News & briefs" },
  guide: { label: "Guide", plural: "Guides" },
  meeting: { label: "Public meeting", plural: "Public meetings" },
  elections: { label: "Elections", plural: "Voting" },
  question: { label: "Commons question", plural: "Discussions" },
};

// Case-insensitive match on the words people use to look things up.
export function searchEntities(catalog: CivicEntity[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return catalog
    .map((e) => {
      const topicNames = e.topics.map((t) => inCatalog(catalog, t)?.name ?? "").join(" ");
      const haystack = [e.name, e.subtitle, e.summary, topicNames, entityKinds[e.kind].label]
        .join(" ")
        .toLowerCase();
      const name = e.name.toLowerCase();
      if (!words.every((w) => haystack.includes(w))) return null;
      return { entity: e, score: words.filter((w) => name.includes(w)).length };
    })
    .filter((r): r is { entity: CivicEntity; score: number } => !!r)
    .sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name))
    .map((r) => r.entity);
}

export function relatedEntities(catalog: CivicEntity[], e: CivicEntity) {
  const ids = new Set([...e.related, ...e.topics]);
  for (const other of catalog)
    if (other.id !== e.id && (other.related.includes(e.id) || other.topics.includes(e.id)))
      ids.add(other.id);
  ids.delete(e.id);
  return [...ids].flatMap((id) => {
    const r = inCatalog(catalog, id);
    return r ? [r] : [];
  });
}

// Upcoming listings tied to an entity: an issue's linked events, or events held
// at (about) the same place. Venue matching tolerates approximate coordinates.
export function eventsForEntity(e: CivicEntity, events: CommunityEvent[], now = new Date()) {
  return events.filter((ev) => {
    if (ev.status !== "published" || eventExpired(ev, now)) return false;
    if (e.kind === "issue" && ev.issueId === e.id) return true;
    return (
      !!e.location &&
      ev.latitude !== null &&
      ev.longitude !== null &&
      distanceMiles([e.location.lat, e.location.lng], [ev.latitude, ev.longitude]) < 0.15
    );
  });
}
