"use client";
import "./civic.css";
import { useState } from "react";
import { categoryColors, kindColors, partyColor } from "@/lib/colors";
import { toneVars } from "@/lib/colors";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CircleDot,
  Construction,
  FileText,
  Gavel,
  GraduationCap,
  HandHeart,
  Landmark,
  MapPin,
  Megaphone,
  MessagesSquare,
  Music,
  Newspaper,
  Palette,
  PartyPopper,
  Plus,
  ShoppingBasket,
  Trees,
  Trophy,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import {
  positions,
  type CivicEntity,
  type CommunityEvent,
  type EntityKind,
  type EventCategory,
  type Position,
  type Snapshot,
} from "@/lib/social/types";
import { catalogOf, entityKinds, eventsForEntity, inCatalog } from "@/lib/social/civic";
import { eventCategories, eventTime } from "@/lib/social/events";
import type { Navigate, Run } from "./social-post";

export const kindIcons: Record<EntityKind, LucideIcon> = {
  official: Landmark,
  institution: Landmark,
  building: Building2,
  organization: Users,
  place: MapPin,
  issue: CircleDot,
  policy: FileText,
  project: Construction,
  news: Newspaper,
  guide: BookOpen,
  meeting: Gavel,
  elections: Vote,
  question: MessagesSquare,
};
const kindTone: Record<EntityKind, string> = {
  official: "navy",
  institution: "slate",
  building: "slate",
  organization: "violet",
  place: "green",
  issue: "cobalt",
  policy: "paper",
  project: "amber",
  news: "paper",
  guide: "cobalt",
  meeting: "amber",
  elections: "cobalt",
  question: "cobalt",
};
export const categoryIcons: Record<EventCategory, LucideIcon> = {
  food_markets: ShoppingBasket,
  arts_culture: Palette,
  festivals_parades: PartyPopper,
  outdoors: Trees,
  volunteering: HandHeart,
  civic_meetings: Gavel,
  campus_life: GraduationCap,
  music: Music,
  sports: Trophy,
  community: Users,
  politics: Megaphone,
};
export const toneForKind = (kind: EntityKind) => kindTone[kind];
export const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("") || name.slice(0, 1).toUpperCase();
export const entityRoute = (id: string) => "entity/" + id;
// Each kind of thing has its own color; news by its category; an official
// by party when a checked source supplies one.
export function toneOf(e: CivicEntity) {
  if (e.story) return categoryColors[e.story.opinion ? "other" : e.story.category];
  return partyColor(e.office?.party)?.color ?? kindColors[e.kind];
}
export function PartyBadge({ entity }: { entity: CivicEntity }) {
  const p = partyColor(entity.office?.party);
  return p ? (
    <span className="party-badge" style={{ "--party": p.text, "--party-tint": p.tint } as React.CSSProperties}>
      {p.label}
    </span>
  ) : null;
}

// Photos and headshots render when a licensed image is supplied. Otherwise
// people and offices get a seal-style monogram, documents a paper tile, and
// everything else a consistent icon tile.
export function EntityVisual({
  entity,
  size = "md",
}: {
  entity: CivicEntity;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const Icon = kindIcons[entity.kind];
  const px = size === "lg" ? 28 : size === "sm" ? 16 : 21;
  if (entity.imageUrl && !failed)
    return (
      // Remote organizer and official images; sized by CSS.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={"entity-visual photo " + size + (entity.kind === "official" ? " round" : "") + (entity.office?.party ? " party" : "")}
        src={entity.imageUrl}
        style={{ objectPosition: entity.imagePosition ?? "center", ...toneVars(toneOf(entity)) } as React.CSSProperties}
        alt={entity.imageAlt ?? ""}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  if (entity.kind === "official")
    return (
      <span
        className={"entity-visual seal " + size + (entity.office?.party ? " party" : "")}
        style={toneVars(toneOf(entity)) as React.CSSProperties}
        aria-hidden="true"
      >
        <span>{entity.monogram ?? initialsFor(entity.name)}</span>
        <Landmark className="seal-badge" size={size === "lg" ? 14 : 11} />
      </span>
    );
  return (
    <span
      className={"entity-visual tile toned tone-" + kindTone[entity.kind] + " " + size + (["policy", "news"].includes(entity.kind) ? " doc" : "")}
      style={toneVars(toneOf(entity)) as React.CSSProperties}
      aria-hidden="true"
    >
      <Icon size={px} />
    </span>
  );
}
export function EventVisual({
  category,
  size = "md",
}: {
  category: EventCategory;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = categoryIcons[category] ?? CalendarDays;
  return (
    <span className={"entity-visual tile tone-event cat-" + category + " " + size} aria-hidden="true">
      <Icon size={size === "lg" ? 28 : size === "sm" ? 16 : 21} />
    </span>
  );
}
export function KindLine({ entity }: { entity: CivicEntity }) {
  return (
    <span className="entity-kind">
      {entityKinds[entity.kind].label}
      {entity.scope === "campus" ? " · Campus" : entity.scope === "national" ? " · National" : " · Local"}
      {entity.sample && <span className="sample-tag">Sample</span>}
      <PartyBadge entity={entity} />
    </span>
  );
}
export function EntityChip({
  entity,
  navigate,
}: {
  entity: CivicEntity;
  navigate: Navigate;
}) {
  const Icon = kindIcons[entity.kind];
  return (
    <button
      className={"entity-chip toned tone-" + kindTone[entity.kind]}
      style={toneVars(toneOf(entity)) as React.CSSProperties}
      data-morph
      onClick={() => navigate(entityRoute(entity.id))}
    >
      <Icon size={13} aria-hidden="true" />
      <span>{entity.name}</span>
    </button>
  );
}
export function EntityRow({
  entity,
  navigate,
  meta,
}: {
  entity: CivicEntity;
  navigate: Navigate;
  meta?: string;
}) {
  return (
    <button className="entity-row toned" style={toneVars(toneOf(entity)) as React.CSSProperties} data-morph onClick={() => navigate(entityRoute(entity.id))}>
      <EntityVisual entity={entity} size="md" />
      <span>
        <KindLine entity={entity} />
        <strong>{entity.name}</strong>
        <small>{meta ?? entity.subtitle}</small>
      </span>
      <ArrowUpRight size={17} aria-hidden="true" />
    </button>
  );
}
export function discussionCount(entity: CivicEntity, data: Snapshot) {
  const topic = data.commons?.topics.find((t) => t.subjectId === entity.id);
  const question = data.commons?.questions.find((q) => q.id === entity.id);
  return question?.participants ?? topic?.participants ?? 0;
}
export function FollowButton({
  entity,
  data,
  run,
  compact = false,
}: {
  entity: CivicEntity;
  data: Snapshot;
  run: Run;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const following = data.follows.some((f) => f.issueId === entity.id);
  const label = (following ? "Following " : "Follow ") + entity.name;
  const noun = entity.kind === "issue" ? " topic" : "";
  return (
    <button
      className={compact ? "icon-btn follow-toggle" : "btn " + (following ? "secondary" : "primary") + " small-btn"}
      data-pop aria-pressed={following}
      aria-label={compact ? label : undefined}
      disabled={pending || data.status !== "ready"}
      onClick={async () => {
        setPending(true);
        try {
          await run({ action: "follow", issueId: entity.id, enabled: !following, notify: false });
        } catch {
          /* The shared error banner explains the failure. */
        } finally {
          setPending(false);
        }
      }}
    >
      {following ? <Check size={15} /> : <Plus size={15} />}
      {!compact && (following ? "Following" + noun + " · Undo" : "Follow" + noun)}
    </button>
  );
}
export function EntityTile({
  entity,
  data,
  run,
  navigate,
}: {
  entity: CivicEntity;
  data: Snapshot;
  run: Run;
  navigate: Navigate;
}) {
  const people = discussionCount(entity, data);
  return (
    <article className="entity-tile">
      <button className="entity-tile-main" onClick={() => navigate(entityRoute(entity.id))}>
        <EntityVisual entity={entity} size="lg" />
        <KindLine entity={entity} />
        <strong>{entity.name}</strong>
        <small>{entity.office ? entity.office.jurisdiction : entity.subtitle}</small>
      </button>
      <footer>
        <span>{people ? people + (people === 1 ? " person" : " people") + " discussing" : entity.location?.label ?? entity.subtitle}</span>
        <FollowButton entity={entity} data={data} run={run} compact />
      </footer>
    </article>
  );
}
const positionTone: Record<Position, string> = {
  support: "support",
  reservations: "reservations",
  mixed: "mixed",
  oppose: "oppose",
  learning: "learning",
};
// Neutral tones on purpose: perspectives are not a red-versus-blue scoreboard.
export function PerspectiveBar({
  counts,
  label = "Perspectives shared",
}: {
  counts: { position: string; count: number }[];
  label?: string;
}) {
  const total = counts.reduce((n, c) => n + c.count, 0);
  if (!total) return null;
  const ordered = (Object.keys(positions) as Position[])
    .map((p) => ({ position: p, count: counts.find((c) => c.position === p)?.count ?? 0 }))
    .filter((c) => c.count);
  return (
    <figure className="perspective-bar">
      <figcaption>
        {label} · {total} {total === 1 ? "person" : "people"}
      </figcaption>
      <div role="img" aria-label={ordered.map((c) => positions[c.position] + ": " + c.count).join(", ")}>
        {ordered.map((c) => (
          <span key={c.position} className={"pos-" + positionTone[c.position]} style={{ flexGrow: c.count }} />
        ))}
      </div>
      <ul>
        {ordered.map((c) => (
          <li key={c.position}>
            <i className={"pos-" + positionTone[c.position]} aria-hidden="true" />
            {positions[c.position]} {c.count}
          </li>
        ))}
      </ul>
    </figure>
  );
}
// The compact card used by the map and search: what it is, why it matters,
// and a bridge into The Commons.
export function EntitySummaryCard({
  entity,
  data,
  run,
  navigate,
  discuss,
  onClose,
}: {
  entity: CivicEntity;
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  discuss: (entity: CivicEntity) => void;
  onClose?: () => void;
}) {
  const people = discussionCount(entity, data);
  const upcoming = eventsForEntity(entity, data.events);
  const catalog = catalogOf(data);
  const topics = entity.topics.flatMap((t) => (inCatalog(catalog, t) ? [inCatalog(catalog, t)!] : []));
  const news = entity.related.flatMap((id) => {
    const r = inCatalog(catalog, id);
    return r?.kind === "news" ? [r] : [];
  });
  return (
    <article className="entity-summary" aria-label={entity.name} data-morph>
      <header>
        <EntityVisual entity={entity} size="lg" />
        <span className="entity-summary-title">
          <KindLine entity={entity} />
          <h3>{entity.name}</h3>
          <small>{entity.subtitle}</small>
        </span>
        {onClose && (
          <button className="icon-btn" aria-label="Close details" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <p>{entity.summary}</p>
      <dl>
        {topics.length > 0 && (
          <>
            <dt>Why it matters</dt>
            <dd>{topics.map((t) => t.name).join(" · ")}</dd>
          </>
        )}
        <dt>In The Commons</dt>
        <dd>{people ? people + (people === 1 ? " person" : " people") + " discussing recently" : "No recent discussion yet"}</dd>
        {upcoming.length > 0 && (
          <>
            <dt>Upcoming</dt>
            <dd>
              {upcoming[0].title} · {eventTime(upcoming[0]).split(" · ").slice(0, 2).join(" · ")}
              {upcoming.length > 1 ? " · +" + (upcoming.length - 1) + " more" : ""}
            </dd>
          </>
        )}
        {news.length > 0 && (
          <>
            <dt>Related brief</dt>
            <dd>{news[0].name}</dd>
          </>
        )}
      </dl>
      <div className="entity-summary-actions">
        <button className="btn primary small-btn" onClick={() => discuss(entity)}>
          <MessagesSquare size={15} />
          {entity.kind === "question" ? "Join the discussion" : "Discuss in The Commons"}
        </button>
        <button className="btn secondary small-btn" onClick={() => navigate(entityRoute(entity.id))}>
          Details <ArrowUpRight size={14} />
        </button>
        <FollowButton entity={entity} data={data} run={run} compact />
      </div>
    </article>
  );
}
export function EventSummaryCard({
  event,
  data,
  navigate,
  discuss,
  onClose,
}: {
  event: CommunityEvent;
  data: Snapshot;
  navigate: Navigate;
  discuss: (event: CommunityEvent) => void;
  onClose?: () => void;
}) {
  const issue = event.issueId ? inCatalog(catalogOf(data), event.issueId) : undefined;
  const saved = data.saved.includes(event.id);
  return (
    <article className="entity-summary" aria-label={event.title}>
      <header>
        <EventVisual category={event.category} size="lg" />
        <span className="entity-summary-title">
          <span className="entity-kind">
            Event · {eventCategories[event.category]}
            {event.sample && <span className="sample-tag">Sample</span>}
          </span>
          <h3>{event.title}</h3>
          <small>{eventTime(event)}</small>
        </span>
        {onClose && (
          <button className="icon-btn" aria-label="Close details" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <p>{event.description}</p>
      <dl>
        <dt>Where</dt>
        <dd>{event.venue}</dd>
        {issue && (
          <>
            <dt>Why it matters</dt>
            <dd>{issue.name}</dd>
          </>
        )}
        {saved && (
          <>
            <dt>Your plans</dt>
            <dd>Saved privately</dd>
          </>
        )}
      </dl>
      <div className="entity-summary-actions">
        <button className="btn primary small-btn" onClick={() => discuss(event)}>
          <MessagesSquare size={15} />
          Discuss in The Commons
        </button>
        <button className="btn secondary small-btn" onClick={() => navigate("event/" + event.id)}>
          Event details <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}
export function SampleNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p className="catalog-notice">
      <BookOpen size={14} />
      {children ??
        "Offices and places describe what they are. Proposals, briefs and starter questions marked Sample are illustrative, not reporting or pending decisions. Map positions are approximate."}
    </p>
  );
}
export function NotifyHint() {
  return (
    <span className="metadata notify-hint">
      <Bell size={12} /> Follow to see new discussions in your Following tab.
    </span>
  );
}
