"use client";
import "./civic.css";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  ExternalLink,
  FileText,
  MapPin,
  MessagesSquare,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { itemById } from "@/lib/polis-data";
import { issues as legacyIssues } from "@/lib/social/catalog";
import { catalogOf, entityKinds, eventsForEntity, inCatalog, relatedEntities } from "@/lib/social/civic";
import { eventTime } from "@/lib/social/events";
import { positions, type CivicEntity, type Position, type Snapshot } from "@/lib/social/types";
import { ItemIcon } from "./common";
import {
  EntityChip,
  EntityRow,
  EntityVisual,
  EventVisual,
  FollowButton,
  KindLine,
  PerspectiveBar,
  SampleNotice,
} from "./civic-cards";
import { Quiet } from "./social-views";
import type { ComposeOptions } from "./social-forms";
import type { Navigate, Run } from "./social-post";

const groups: { label: string; kinds: CivicEntity["kind"][] }[] = [
  { label: "Discussions", kinds: ["question"] },
  { label: "People & offices", kinds: ["official"] },
  { label: "Proposals & projects", kinds: ["policy", "project"] },
  { label: "Places & institutions", kinds: ["institution", "building", "place", "elections"] },
  { label: "Organizations & meetings", kinds: ["organization", "meeting"] },
  { label: "Issues", kinds: ["issue"] },
  { label: "Briefs", kinds: ["news"] },
];
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function EntityPage({
  id,
  data,
  run,
  navigate,
  compose,
  children,
}: {
  id: string;
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  compose: (o: ComposeOptions) => void;
  children: React.ReactNode;
}) {
  const catalog = catalogOf(data);
  const entityFor = (x: string) => inCatalog(catalog, x);
  const entity = entityFor(id);
  const [perspective, setPerspective] = useState<Position | "">("");
  if (!entity)
    return (
      <Quiet title="This page is not part of your current community.">
        Switch communities or return to{" "}
        <button className="text-button" onClick={() => navigate("commons")}>
          The Commons
        </button>
        .
      </Quiet>
    );
  const related = relatedEntities(catalog, entity);
  const upcoming = eventsForEntity(entity, data.events).slice(0, 4);
  const saved = data.saved.includes(entity.id);
  const stats = data.commons?.questions.find((q) => q.id === entity.id);
  const legacy = entity.kind === "issue" ? legacyIssues.find((i) => i.id === entity.id) : undefined;
  const discuss = () =>
    compose({
      subjectId: entity.id,
      kind: entity.kind === "question" ? "opinion" : "debate",
      audience: "community",
      coverage: "local",
    });
  const save = async () => {
    try {
      await run({ action: "save", targetId: entity.id, enabled: !saved });
      toast.success(saved ? "Removed from saved." : "Saved privately.");
    } catch {
      /* The shared error banner explains the failure. */
    }
  };
  return (
    <article className={"entity-page kind-" + entity.kind}>
      <button className="text-button" onClick={() => history.back()}>
        <ArrowLeft size={15} />
        Back
      </button>
      <header className="entity-hero">
        <EntityVisual entity={entity} size="lg" />
        <div>
          <KindLine entity={entity} />
          <h1>{entity.name}</h1>
          <p>{entity.subtitle}</p>
        </div>
      </header>
      <div className="form-actions entity-actions">
        <button className="btn primary" onClick={discuss}>
          <MessagesSquare size={16} />
          {entity.kind === "question" ? "Share your perspective" : "Discuss in The Commons"}
        </button>
        <FollowButton entity={entity} data={data} run={run} />
        <button className="btn secondary small-btn" aria-pressed={saved} onClick={() => void save()}>
          <Bookmark size={15} />
          {saved ? "Saved" : "Save"}
        </button>
        {entity.location && (
          <button className="btn secondary small-btn" onClick={() => navigate("explore?selected=" + entity.id)}>
            <MapPin size={15} />
            Show on map
          </button>
        )}
      </div>

      {entity.kind === "question" && entity.debate ? (
        <section className="debate">
          <p className="entity-summary-text">{entity.summary}</p>
          <p className="catalog-notice">{entity.debate.context}</p>
          <div className="debate-grid">
            {entity.debate.perspectives.map((p) => (
              <section key={p.label}>
                <h2>{p.label}</h2>
                <ul>
                  {p.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {stats && stats.positions.length > 0 && (
            <PerspectiveBar counts={stats.positions} label="Where students have landed" />
          )}
        </section>
      ) : (
        <section className="entity-body">
          <p className="entity-summary-text">{entity.summary}</p>
          {entity.background && (
            <div className="commons-background">
              <FileText size={22} />
              <h2>Sourced background</h2>
              <p>{entity.background.text}</p>
              <a href={entity.background.url} target="_blank" rel="noopener noreferrer">
                {entity.background.documentTitle}
                <ArrowUpRight size={16} />
              </a>
              <p className="metadata">
                {entity.background.publisher} ·{" "}
                {entity.background.sourceDate ? "Published " + entity.background.sourceDate : "Publication date not supplied"} ·
                Checked {entity.background.checkedAt}
              </p>
              <p className="metadata">
                Check the original source for changes since this review. Member perspectives appear separately below.
              </p>
            </div>
          )}
          {entity.details && (
            <ul>
              {entity.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <dl className="entity-facts">
            {entity.office && (
              <>
                <dt>Office</dt>
                <dd>{entity.office.title}</dd>
                <dt>Jurisdiction</dt>
                <dd>{entity.office.jurisdiction}</dd>
                <dt>Officeholder</dt>
                <dd>
                  {entity.office.officeholder ?? "Not listed in Polis yet."}{" "}
                  {entity.office.directoryUrl && (
                    <a href={entity.office.directoryUrl} target="_blank" rel="noopener noreferrer">
                      Official directory <ExternalLink size={12} />
                    </a>
                  )}
                </dd>
                {entity.office.party && (
                  <>
                    <dt>Party</dt>
                    <dd>{entity.office.party}</dd>
                  </>
                )}
              </>
            )}
            {entity.policy && (
              <>
                <dt>Status</dt>
                <dd>
                  <span className="status-pill">{entity.policy.status}</span>
                </dd>
                <dt>Category</dt>
                <dd>{entity.policy.category}</dd>
                {entity.policy.institutionId && entityFor(entity.policy.institutionId) && (
                  <>
                    <dt>Responsible</dt>
                    <dd>
                      <EntityChip entity={entityFor(entity.policy.institutionId)!} navigate={navigate} />
                    </dd>
                  </>
                )}
              </>
            )}
            {entity.news && (
              <>
                <dt>Source</dt>
                <dd>{entity.news.source}</dd>
                <dt>Published</dt>
                <dd>{dateLabel(entity.news.publishedAt)}</dd>
              </>
            )}
            {entity.meeting && (
              <>
                <dt>When</dt>
                <dd>{entity.meeting.schedule}</dd>
                {entity.meeting.bodyId && entityFor(entity.meeting.bodyId) && (
                  <>
                    <dt>Body</dt>
                    <dd>
                      <EntityChip entity={entityFor(entity.meeting.bodyId)!} navigate={navigate} />
                    </dd>
                  </>
                )}
              </>
            )}
            {entity.location && (
              <>
                <dt>Where</dt>
                <dd>
                  {entity.location.label}
                  {entity.location.approximate ? " · approximate map position" : ""}
                </dd>
              </>
            )}
            {entity.topics.length > 0 && (
              <>
                <dt>Issues</dt>
                <dd className="chip-row">
                  {entity.topics.map((t) =>
                    entityFor(t) ? <EntityChip key={t} entity={entityFor(t)!} navigate={navigate} /> : null,
                  )}
                </dd>
              </>
            )}
          </dl>
          {entity.policy && entity.policy.steps.length > 0 && (
            <section className="issue-timeline">
              <h2>How a decision like this moves</h2>
              {entity.policy.steps.map((s) => (
                <div key={s.when + s.label}>
                  <span>{s.when}</span>
                  <p>{s.label}</p>
                </div>
              ))}
            </section>
          )}
        </section>
      )}

      {(entity.policy?.documents.length || entity.debate?.documents.length || entity.sourceUrl || entity.meeting?.calendarUrl) && (
        <section className="entity-documents">
          <h2>Documents & sources</h2>
          {[...(entity.policy?.documents ?? []), ...(entity.debate?.documents ?? [])].map((d) => (
            <a key={d.url + d.title} href={d.url} target="_blank" rel="noopener noreferrer">
              <FileText size={15} /> {d.title} <ArrowUpRight size={13} />
            </a>
          ))}
          {entity.meeting?.calendarUrl && (
            <a href={entity.meeting.calendarUrl} target="_blank" rel="noopener noreferrer">
              <CalendarDays size={15} /> Official meeting calendar <ArrowUpRight size={13} />
            </a>
          )}
          {entity.sourceUrl && (
            <a href={entity.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> {entity.kind === "elections" ? "Official voter lookup" : entity.sourceLabel ?? "Reference"}{" "}
              <ArrowUpRight size={13} />
            </a>
          )}
        </section>
      )}

      {entity.kind === "issue" && (
        <IssueExtras entity={entity} data={data} run={run} navigate={navigate} legacyItems={legacy?.items ?? []} />
      )}

      {(upcoming.length > 0 || entity.kind === "issue") && (
        <section className="entity-events">
          <h2>{entity.kind === "issue" ? "Related events and places" : "Upcoming here"}</h2>
          {!upcoming.length && <p className="metadata">No checked upcoming events linked to this topic yet.</p>}
          {upcoming.map((e) => (
            <button key={e.id} className="entity-row" onClick={() => navigate("event/" + e.id)}>
              <EventVisual category={e.category} />
              <span>
                <span className="entity-kind">
                  Event{e.sample && <span className="sample-tag">Sample</span>}
                </span>
                <strong>{e.title}</strong>
                <small>{eventTime(e)}</small>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          ))}
          {entity.kind === "issue" && (
            <button className="text-button" onClick={() => navigate("explore/events?mode=map")}>
              Explore the local map and event list <ArrowUpRight size={15} />
            </button>
          )}
        </section>
      )}

      <section className="entity-discussion">
        <div className="section-row">
          <h2 className="discussion-heading">
            {entity.kind === "question" ? "Student responses" : entity.kind === "issue" ? "Community perspectives" : "In The Commons"}
          </h2>
          <button className="btn secondary small-btn" onClick={discuss}>
            <Plus size={15} />
            {entity.kind === "question" ? "Respond" : "Start a discussion"}
          </button>
        </div>
        {entity.kind === "question" && !entity.debate?.openEnded && (
          <div className="perspective-filter" role="group" aria-label="Filter responses by perspective">
            {[["", "All"], ...Object.entries(positions)].map(([value, label]) => (
              <button
                key={value || "all"}
                aria-pressed={perspective === value}
                onClick={() => setPerspective(value as Position | "")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div data-perspective={perspective || undefined} className="entity-feed">
          {children}
        </div>
      </section>

      {related.length > 0 && (
        <section className="entity-related">
          <h2>Connected</h2>
          {groups.map((g) => {
            const rows = related.filter((r) => g.kinds.includes(r.kind));
            return rows.length ? (
              <div key={g.label}>
                <h3>{g.label}</h3>
                {rows.map((r) => (
                  <EntityRow key={r.id} entity={r} navigate={navigate} />
                ))}
              </div>
            ) : null;
          })}
        </section>
      )}
      <SampleNotice>
        {entity.sample
          ? entityKinds[entity.kind].label + " marked Sample: illustrative content written for this pilot, not reporting or a pending decision."
          : "Polis describes what this " + entityKinds[entity.kind].label.toLowerCase() + " is. Check the linked official source for current details" + (entity.location?.approximate ? "; the map position is approximate." : ".")}
      </SampleNotice>
    </article>
  );
}

function IssueExtras({
  entity,
  data,
  run,
  navigate,
  legacyItems,
}: {
  entity: CivicEntity;
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  legacyItems: string[];
}) {
  const followed = data.follows.find((f) => f.issueId === entity.id);
  const updates = data.updates.filter((u) => u.issueId === entity.id);
  const prioritized = data.priorities.some((p) => p.issueId === entity.id);
  return (
    <section className="issue-extras">
      <div className="form-actions">
        <button
          className="btn secondary small-btn"
          onClick={() => {
            if (prioritized) navigate("rankings");
            else void run({ action: "priority.save", issueId: entity.id }).catch(() => {});
          }}
        >
          {prioritized ? "In my priorities" : "Add to my priorities"}
        </button>
        {followed && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={!!followed.notify}
              onChange={async (e) => {
                const notify = e.target.checked;
                try {
                  if (notify && !data.preferences.issues)
                    await run({
                      action: "preferences",
                      replies: !!data.preferences.replies,
                      reactions: !!data.preferences.reactions,
                      events: !!data.preferences.events,
                      issues: true,
                    });
                  await run({ action: "follow", issueId: entity.id, enabled: true, notify });
                } catch {
                  /* The shared error banner explains the failure. */
                }
              }}
            />
            Notify me in Polis when a curator adds an update
          </label>
        )}
      </div>
      {legacyItems.length > 0 && (
        <details className="issue-context">
          <summary>Sample catalog items for this issue</summary>
          {legacyItems
            .filter((i) => Object.hasOwn(itemById, i))
            .map((i) => itemById[i])
            .map((item) => (
              <button key={item.id} className="catalog-row" onClick={() => navigate("item/" + item.id)}>
                <ItemIcon item={item} />
                <span>
                  <small>{item.kind} · Fictional sample</small>
                  <h3>{item.title}</h3>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
        </details>
      )}
      <section className="issue-timeline">
        <h2>Developments</h2>
        {updates.length ? (
          updates.map((u) => (
            <div key={u.id}>
              <span>
                {new Date(u.createdAt).toLocaleDateString()} · {u.sample ? "Sample" : "Curator source"}
              </span>
              <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer">
                {u.title} <ArrowUpRight size={13} />
              </a>
            </div>
          ))
        ) : (
          <p>No dated milestones are published yet. Follow this issue to see new discussions and updates.</p>
        )}
      </section>
    </section>
  );
}
