"use client";
import "./civic.css";
import { ArrowUpRight, Search } from "lucide-react";
import type { CivicEntity, Snapshot } from "@/lib/social/types";
import { searchEntities } from "@/lib/social/civic";
import { discoverEvents, eventTime } from "@/lib/social/events";
import { EntityRow, EventVisual } from "./civic-cards";
import type { Navigate } from "./social-post";

// One query across the community's civic catalog, events and conversations.
// New result types add a group here; the catalog search stays in one helper.
const groups: { label: string; kinds: CivicEntity["kind"][] }[] = [
  { label: "Issues", kinds: ["issue"] },
  { label: "Discussions", kinds: ["question"] },
  { label: "People & offices", kinds: ["official"] },
  { label: "Policies & projects", kinds: ["policy", "project"] },
  { label: "Places & buildings", kinds: ["place", "building", "institution", "elections"] },
  { label: "Organizations & meetings", kinds: ["organization", "meeting"] },
  { label: "News & briefs", kinds: ["news"] },
];

export function SearchView({
  query,
  data,
  navigate,
  loading,
  children,
}: {
  query: string;
  data: Snapshot;
  navigate: Navigate;
  loading: boolean;
  children: React.ReactNode;
}) {
  const q = query.trim();
  const entities = searchEntities(data.community?.id ?? "", q);
  const events = q
    ? discoverEvents(data.events, { ...data.eventPreferences, interests: [] }, { q, city: "" }).map((r) => r.event)
    : [];
  const nothing = q && !entities.length && !events.length && !data.posts.length && !loading;
  return (
    <section className="search-view">
      <p className="social-section-label">SEARCH · {(data.community?.name ?? "").toUpperCase()}</p>
      <h1>{q ? "Results for “" + q + "”" : "Search your community"}</h1>
      {!q && (
        <p className="metadata">
          Search people, offices, issues, proposals, places, events, discussions and briefs. Try “housing”, “bus” or “student government”.
        </p>
      )}
      {groups.map((g) => {
        const rows = entities.filter((e) => g.kinds.includes(e.kind));
        return rows.length ? (
          <section key={g.label} className="search-group">
            <h2>{g.label}</h2>
            {rows.slice(0, 6).map((e) => (
              <EntityRow key={e.id} entity={e} navigate={navigate} />
            ))}
          </section>
        ) : null;
      })}
      {events.length > 0 && (
        <section className="search-group">
          <h2>Events</h2>
          {events.slice(0, 6).map((e) => (
            <button key={e.id} className="entity-row" onClick={() => navigate("event/" + e.id)}>
              <EventVisual category={e.category} />
              <span>
                <span className="entity-kind">Event{e.sample && <span className="sample-tag">Sample</span>}</span>
                <strong>{e.title}</strong>
                <small>{eventTime(e)}</small>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          ))}
        </section>
      )}
      {q && (
        <section className="search-group">
          <h2>Conversations</h2>
          {children}
        </section>
      )}
      {nothing && (
        <div className="social-empty">
          <Search size={27} />
          <h2>Nothing matches “{q}” yet.</h2>
          <p>Try a broader word, or start a discussion about it in The Commons.</p>
        </div>
      )}
    </section>
  );
}
