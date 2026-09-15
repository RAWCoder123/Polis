"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Check,
  Lock,
  MapPin,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { items, itemById, kinds, type CivicItem } from "@/lib/polis-data";
import { issues, issueFor, subjectTitle } from "@/lib/social/catalog";
import {
  audiences,
  type Snapshot,
  type Person,
  type Post,
} from "@/lib/social/types";
import { Avatar, ItemIcon, Score } from "./common";
import EventExplorer from "./event-explorer";
import { sampleEventCalendar } from "@/lib/social/calendar";
import { IssuePriorities } from "./issue-priorities";
import { EventPlanEditor } from "./event-plan";
import { ReplyComposer, type ComposeOptions, Modal } from "./social-forms";
import { PostCard, type Run, type Navigate } from "./social-post";
export function Quiet({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="social-empty">
      <MessageCircle size={27} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Explore({
  query,
  navigate,
  explore,
  data,
  run,
  category,
  selectedId,
  params,
}: {
  query: string;
  navigate: Navigate;
  explore: (route: string) => void;
  data: Snapshot;
  run: Run;
  category?: string;
  selectedId?: string;
  params: URLSearchParams;
}) {
  const tab =
    ["Issues", ...kinds].find((k) => k.toLowerCase() === category) ?? "Issues";
  const found = items.filter(
    (i) =>
      i.kind === tab &&
      (!query ||
        (i.title + " " + i.topic + " " + i.summary)
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const foundIssues = issues.filter((i) =>
    (i.name + " " + i.description).toLowerCase().includes(query.toLowerCase()),
  );
  function changeTab(k: string) {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    explore("explore/" + k.toLowerCase() + (p.size ? "?" + p : ""));
  }
  return (
    <>
      <nav className="social-tabs" aria-label="Explore categories">
        {["Issues", ...kinds].map((k) => (
          <button
            key={k}
            aria-current={k === tab ? "page" : undefined}
            className={k === tab ? "active" : ""}
            onClick={() => changeTab(k)}
          >
            {k}
          </button>
        ))}
      </nav>
      <p className="catalog-notice">
        {tab === "Events"
          ? "Sample events · Fictional gatherings and illustrative locations."
          : "Sample civic catalog · The proposals, people, stories, and events here are illustrative, not verified current local records."}
      </p>
      {tab === "Events" ? (
        <EventExplorer
          data={data}
          run={run}
          selectedId={selectedId}
          params={params}
          navigate={navigate}
          explore={explore}
        />
      ) : tab === "Issues" ? (
        <>
          {foundIssues.map((issue, i) => (
            <button
              className="issue-explore-row"
              key={issue.id}
              onClick={() => navigate("issue/" + issue.id)}
            >
              <span className={"issue-square tone-" + i}>{i + 1}</span>
              <span>
                <h2>{issue.name}</h2>
                <p>{issue.description}</p>
              </span>
              <ArrowUpRight size={21} />
            </button>
          ))}
          {!foundIssues.length && (
            <Quiet title="No issues match that search.">
              Try housing, transit, public spaces, or libraries.{" "}
              <button
                className="text-button"
                onClick={() => explore("explore/issues")}
              >
                Clear search
              </button>
            </Quiet>
          )}
        </>
      ) : (
        <>
          {found.map((item) => (
            <button
              className="catalog-row"
              key={item.id}
              onClick={() => navigate("item/" + item.id)}
            >
              <ItemIcon item={item} />
              <span>
                <small>
                  {item.topic} · Sample {item.kind.toLowerCase()}
                </small>
                <h2>{item.title}</h2>
                <p>{item.subtitle}</p>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
          {!found.length && (
            <Quiet title="Nothing matches just yet.">
              Try another category or search term.{" "}
              <button
                className="text-button"
                onClick={() => explore("explore/" + tab.toLowerCase())}
              >
                Clear search
              </button>
            </Quiet>
          )}
        </>
      )}
    </>
  );
}
export function ItemDetail({
  item,
  data,
  navigate,
  compose,
  rank,
  run,
}: {
  item: CivicItem;
  data: Snapshot;
  navigate: Navigate;
  compose: (o: ComposeOptions) => void;
  rank: (item?: CivicItem) => void;
  run: Run;
}) {
  const issue = issueFor(item.id)!;
  const attendees = data.plans.filter(
    (p) => p.eventId === item.id && p.userId !== data.me?.id,
  );
  return (
    <article className="civic-detail">
      <button
        className="text-button"
        onClick={() => navigate("issue/" + issue.id)}
      >
        <ArrowLeft size={15} />
        {issue.name}
      </button>
      <p className="catalog-notice">
        {item.kind === "Politicians"
          ? "Fictional candidate"
          : "Illustrative " + item.kind.toLowerCase()}{" "}
        · Not a verified local record
      </p>
      {item.event && (
        <button
          className="text-button event-back-map"
          onClick={() => navigate("explore/events/" + item.id)}
        >
          <MapPin size={15} />
          Show on the event map
        </button>
      )}
      <h1>{item.title}</h1>
      <p className="civic-subtitle">{item.subtitle}</p>
      {item.kind === "News" && (
        // This preserved optimized WebP is served directly by the Worker.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="civic-image"
          src="/images/community-street.webp"
          alt="Illustrative college-town street"
        />
      )}
      <p>{item.summary}</p>
      {item.event && (
        <div className="event-fact-list">
          <span>
            <CalendarDays size={18} />
            September {item.event.day}, 2026 · {item.event.time} (Eastern)
          </span>
          <span>
            <MapPin size={18} />
            {item.event.place} · illustrative location
          </span>
          <span>Organizer: Polis demo community · fictional event</span>
          <span>
            Time zone: America/New_York · Cost not provided.
          </span>
          <span>
            No registration or organizer source is available for this sample
            event.
          </span>
        </div>
      )}
      <h2>{item.kind === "News" ? "The short read" : "What to know"}</h2>
      <ul>
        {item.details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      {!item.event && (
        <>
          <h2>Questions worth asking</h2>
          <ul>
            {item.considerations.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
      <div className="civic-actions">
        {item.event && (
          <>
            <button
              className="btn secondary"
              onClick={() =>
                compose({ subjectId: item.id, kind: "event_share" })
              }
            >
              Share event with a note
            </button>
            <a
              className="btn secondary"
              download={"polis-sample-" + item.id + ".ics"}
              href={
                "data:text/calendar;charset=utf-8," +
                encodeURIComponent(sampleEventCalendar(item))
              }
            >
              <CalendarDays size={16} />
              Download sample calendar file
            </a>
          </>
        )}
        <button
          className="btn primary"
          onClick={() => compose({ subjectId: item.id })}
        >
          Add your {item.event ? "reflection" : "take"}
          <Plus size={16} />
        </button>
        <button className="btn secondary" onClick={() => rank(item)}>
          Rank{" "}
          {item.kind === "News"
            ? "usefulness"
            : item.event
              ? "the sample experience"
              : "this item"}
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            void run({
              action: "save",
              targetId: item.id,
              enabled: !data.saved.includes(item.id),
            }).catch(() => {});
          }}
        >
          {data.saved.includes(item.id) ? "Saved" : "Save for later"}
        </button>
      </div>
      {item.event && (
        <section className="event-plan-panel">
          <h2>Your plan</h2>
          <EventPlanEditor
            key={item.id}
            eventId={item.id}
            data={data}
            run={run}
          />
          <h3>Shared plans</h3>
          {attendees.length ? (
            attendees.map((p) => (
              <p key={p.userId}>
                {p.name} ·{" "}
                {p.status === "attending" ? "Planning to attend" : "Interested"}
              </p>
            ))
          ) : (
            <p>No one has shared a plan with you yet.</p>
          )}
          <button
            className="text-button"
            onClick={() => navigate("issue/" + issue.id)}
          >
            Join the event’s issue discussion <ArrowRight size={15} />
          </button>
        </section>
      )}
      <h2>Keep exploring</h2>
      {item.related.map((id) => (
        <button
          key={id}
          className="catalog-row"
          onClick={() => navigate("item/" + id)}
        >
          <ItemIcon item={itemById[id]} />
          <span>
            <h3>{itemById[id].title}</h3>
            <small>{itemById[id].kind}</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      ))}
      <p className="metadata">
        Source: original fictional Polis demonstration content.{" "}
        <a href={issue.source} target="_blank" rel="noreferrer">
          Community reference website
        </a>{" "}
        is provided for independent exploration and does not substantiate this
        sample.
      </p>
    </article>
  );
}
export function IssueDetail({
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
  const issue = issues.find((i) => i.id === id);
  if (!issue)
    return (
      <Quiet title="Issue unavailable.">
        Return to Explore to find another issue.
      </Quiet>
    );
  const followed = data.follows.find((f) => f.issueId === id);
  return (
    <>
      <div className="issue-heading">
        <span className="social-section-label">
          SAMPLE ISSUE · ITHACA & CORNELL
        </span>
        <h1>{issue.name}</h1>
        <p>{issue.description}</p>
        <div className="form-actions">
          <button
            className={"btn " + (followed ? "secondary" : "primary")}
            onClick={() => {
              void run({
                action: "follow",
                issueId: id,
                enabled: !followed,
                notify: false,
              }).catch(() => {});
            }}
          >
            {followed ? <Check size={16} /> : <Plus size={16} />}{" "}
            {followed ? "Following" : "Follow issue"}
          </button>
          <button
            className="btn secondary"
            onClick={() => compose({ subjectId: id, kind: "question" })}
          >
            Ask a question
          </button>
          <button
            className="btn secondary"
            onClick={() => compose({ subjectId: id, kind: "opinion" })}
          >
            Share a view
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              if (data.priorities.some((p) => p.issueId === id))
                navigate("rankings");
              else
                void run({ action: "priority.save", issueId: id }).catch(
                  () => {},
                );
            }}
          >
            {data.priorities.some((p) => p.issueId === id)
              ? "In my priorities"
              : "Add to my priorities"}
          </button>
        </div>
        {followed && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={!!followed.notify}
              onChange={(e) => {
                void run({
                  action: "follow",
                  issueId: id,
                  enabled: true,
                  notify: e.target.checked,
                }).catch(() => {});
              }}
            />
            Notify me about significant updates
          </label>
        )}
      </div>
      <p className="catalog-notice">
        This is sample background, not a verified account of a current proposal.
        The community reference is a starting point. Dated, sourced updates will
        appear below when published.
      </p>
      <details className="issue-context" open>
        <summary>Understand this issue</summary>
        {issue.items
          .map((item) => itemById[item])
          .map((item) => (
            <button
              key={item.id}
              className="catalog-row"
              onClick={() => navigate("item/" + item.id)}
            >
              <ItemIcon item={item} />
              <span>
                <small>{item.kind}</small>
                <h3>{item.title}</h3>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        <a
          className="text-button"
          href={issue.source}
          target="_blank"
          rel="noreferrer"
        >
          Community reference <ArrowUpRight size={14} />
        </a>
      </details>
      <section className="issue-timeline">
        <h2>What happens next</h2>
        {data.updates.filter((u) => u.issueId === id).length ? (
          data.updates
            .filter((u) => u.issueId === id)
            .map((u) => (
              <div key={u.id}>
                <span>
                  {new Date(u.createdAt).toLocaleDateString()}{" "}
                  {u.sample ? "· Illustrative update" : ""}
                </span>
                <p>{u.title}</p>
                <a href={u.sourceUrl} target="_blank" rel="noreferrer">
                  {u.sample ? "Reference" : "Source"} <ArrowUpRight size={13} />
                </a>
              </div>
            ))
        ) : (
          <p>
            There are no verified milestones published here yet. Follow the
            issue for future updates.
          </p>
        )}
      </section>
      <h2 className="discussion-heading">The conversation around this issue</h2>
      {children}
    </>
  );
}
export function RankingList({
  data,
  run,
  rank,
  share,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  rank: (item?: CivicItem) => void;
  share: () => void;
  navigate: Navigate;
}) {
  const [kind, setKind] = useState("Issues");
  const rows = data.rankings.filter((r) => itemById[r.itemId]?.kind === kind);
  async function move(id: string, d: number) {
    const order = [...rows.map((r) => r.itemId)];
    const n = order.indexOf(id);
    [order[n], order[n + d]] = [order[n + d], order[n]];
    try {
      await run({ action: "ranking.order", itemIds: order });
    } catch {}
  }
  return (
    <>
      {kind !== "Issues" && (
        <div className="civic-actions">
          <button className="btn primary" onClick={() => rank()}>
            <Plus size={16} />
            Add a ranking
          </button>
          <button
            className="btn secondary"
            onClick={share}
            disabled={!data.rankings.length}
          >
            Share selected list <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      <div className="social-tabs">
        {["Issues", ...kinds].map((k) => (
          <button
            key={k}
            className={kind === k ? "active" : ""}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      {kind === "Issues" ? (
        <IssuePriorities data={data} run={run} navigate={navigate} />
      ) : (
        <>
          <p className="catalog-notice">
            <Lock size={14} /> Your rankings and notes are private. Saving never
            publishes a post.
          </p>
          {rows.map((r, i) => (
            <article className="live-ranking" key={r.itemId}>
              <span className="rank-position">
                {String(i + 1).padStart(2, "0")}
              </span>
              <button onClick={() => navigate("item/" + r.itemId)}>
                <small>
                  {kind === "Policies"
                    ? "Priority " + (i + 1)
                    : kind === "News"
                      ? "Usefulness"
                      : kind === "Politicians"
                        ? "Personal support"
                        : "Sample experience"}
                </small>
                <h2>{subjectTitle(r.itemId)}</h2>
                {r.note && <p>{r.note}</p>}
              </button>
              <Score value={r.score} />
              <div className="rank-controls">
                <button
                  className="icon-btn"
                  disabled={i === 0}
                  aria-label={"Move " + subjectTitle(r.itemId) + " up"}
                  onClick={() => void move(r.itemId, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-btn"
                  disabled={i === rows.length - 1}
                  aria-label={"Move " + subjectTitle(r.itemId) + " down"}
                  onClick={() => void move(r.itemId, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={"Edit " + subjectTitle(r.itemId)}
                  onClick={() => rank(itemById[r.itemId])}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={"Remove " + subjectTitle(r.itemId)}
                  onClick={() => {
                    void run({
                      action: "ranking.delete",
                      itemId: r.itemId,
                    }).catch(() => {});
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <Quiet title="Your perspective starts with you.">
              Add an item when you’re ready. You can join a conversation without
              ranking anything.
            </Quiet>
          )}
          <p className="metadata">
            {kind === "Policies"
              ? "Priority order and support scores are separate."
              : kind === "News"
                ? "Usefulness does not establish factual accuracy."
                : kind === "Politicians"
                  ? "Your assessment does not imply a party affiliation."
                  : "Rate an experience separately from interest or plans to attend."}
          </p>
        </>
      )}
    </>
  );
}
export function Friends({
  data,
  run,
  navigate,
  query,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  query: string;
}) {
  const [tab, setTab] = useState("Friends");
  const people = data.people
    .filter((p) =>
      (p.name + " " + p.username).toLowerCase().includes(query.toLowerCase()),
    )
    .filter((p) =>
      tab === "Friends"
        ? p.relationship === "friends" && !p.blocked
        : tab === "Requests"
          ? p.relationship === "incoming" || p.relationship === "outgoing"
          : tab === "Blocked"
            ? p.blocked
            : !p.blocked,
    );
  return (
    <>
      <div className="social-tabs">
        {["Friends", "Requests", "Discover people", "Blocked"].map((t) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="catalog-notice">
        Friends are accepted mutual relationships. Discover people by name or
        username using search above.
      </p>
      {people.map((p) => (
        <article key={p.id} className="person-row">
          <Avatar
            initials={p.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          />
          <button
            className="person-info"
            onClick={() => navigate("profile/" + p.id)}
            disabled={!!p.blocked}
          >
            <strong>{p.name}</strong>
            <span>
              @{p.username} · {p.communityLabel}
            </span>
          </button>
          {p.blocked ? (
            <button
              className="btn secondary small-btn"
              onClick={() => {
                void run({
                  action: "block",
                  targetId: p.id,
                  enabled: false,
                }).catch(() => {});
              }}
            >
              Unblock
            </button>
          ) : p.relationship === "friends" ? (
            <button
              className="btn secondary small-btn"
              onClick={() => navigate("profile/" + p.id)}
            >
              View profile
            </button>
          ) : p.relationship === "incoming" ? (
            <button
              className="btn primary small-btn"
              onClick={() => {
                void run({
                  action: "friend",
                  targetId: p.id,
                  operation: "accept",
                }).catch(() => {});
              }}
            >
              Accept request
            </button>
          ) : p.relationship === "outgoing" ? (
            <button
              className="btn secondary small-btn"
              onClick={() => {
                void run({
                  action: "friend",
                  targetId: p.id,
                  operation: "remove",
                }).catch(() => {});
              }}
            >
              Cancel request
            </button>
          ) : (
            <button
              className="btn primary small-btn"
              onClick={() => {
                void run({
                  action: "friend",
                  targetId: p.id,
                  operation: "request",
                }).catch(() => {});
              }}
            >
              Add friend
            </button>
          )}
        </article>
      ))}
      {!people.length && (
        <Quiet
          title={
            tab === "Requests"
              ? "No requests right now."
              : tab === "Blocked"
                ? "No blocked people."
                : "Room for a familiar face."
          }
        >
          {tab === "Friends"
            ? "Find an invited community member in Discover people to start a friendship."
            : "People matching this view will appear here."}
        </Quiet>
      )}
    </>
  );
}
export function Profile({
  person,
  data,
  run,
  navigate,
  edit,
  report,
  children,
}: {
  person: Person | undefined;
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  edit: () => void;
  report: (id: string) => void;
  children: React.ReactNode;
}) {
  if (!person || person.blocked)
    return (
      <Quiet title="Profile unavailable.">
        This person’s profile cannot be displayed.
      </Quiet>
    );
  const self = person.id === data.me?.id;
  const lists = data.lists?.filter((l) => l.userId === person.id) ?? [];
  const plans = data.plans.filter((p) => p.userId === person.id);
  const myShared = new Map<string, { score: number }>(
    data.lists
      ?.filter((l) => l.userId === data.me?.id)
      .slice()
      .reverse()
      .flatMap((l) =>
        JSON.parse(l.itemsJson)
          .filter((r: { score?: number }) => typeof r.score === "number")
          .map((r: { itemId: string; score: number }) => [r.itemId, r]),
      ) ?? [],
  );
  const theirs = new Map<string, { score: number }>(
    lists
      .slice()
      .reverse()
      .flatMap((l) =>
        JSON.parse(l.itemsJson)
          .filter((r: { score?: number }) => typeof r.score === "number")
          .map((r: { itemId: string; score: number }) => [r.itemId, r]),
      ),
  );
  const overlap = [...theirs.entries()].filter(([id]) => myShared.has(id));
  return (
    <>
      <div className="live-profile">
        <Avatar
          initials={person.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
          size="hero"
        />
        <h1>{person.name}</h1>
        <span>
          @{person.username} · {person.communityLabel}
        </span>
        <p>
          {person.bio ||
            "Getting to know the community, one conversation at a time."}
        </p>
        <div className="form-actions">
          {self ? (
            <>
              <button className="btn secondary" onClick={edit}>
                Edit profile
              </button>
              {person.role === "owner" && (
                <button
                  className="text-button"
                  onClick={() => navigate("admin")}
                >
                  Community tools
                </button>
              )}
              <a
                className="text-button"
                href="/signout-with-chatgpt?return_to=%2F"
                target="_top"
              >
                Sign out
              </a>
            </>
          ) : (
            <>
              <button
                className="btn secondary"
                onClick={() => {
                  void run({
                    action: "mute",
                    targetId: person.id,
                    enabled: !person.muted,
                  }).catch(() => {});
                }}
              >
                {person.muted ? "Unmute" : "Mute"}
              </button>
              {person.relationship !== "friends" && (
                <button
                  className="btn primary"
                  disabled={person.relationship === "outgoing"}
                  onClick={() => {
                    void run({
                      action: "friend",
                      targetId: person.id,
                      operation:
                        person.relationship === "incoming"
                          ? "accept"
                          : "request",
                    }).catch(() => {});
                  }}
                >
                  {person.relationship === "incoming"
                    ? "Accept request"
                    : person.relationship === "outgoing"
                      ? "Request sent"
                      : "Add friend"}
                </button>
              )}
              {person.relationship === "friends" && (
                <button
                  className="text-button"
                  onClick={() => {
                    void run({
                      action: "friend",
                      targetId: person.id,
                      operation: "remove",
                    }).catch(() => {});
                  }}
                >
                  Remove friend
                </button>
              )}
              <button
                className="text-button"
                onClick={() => report("block:" + person.id)}
              >
                Block
              </button>
            </>
          )}
        </div>
      </div>
      {self && <IssuePriorities data={data} run={run} navigate={navigate} />}
      <h2 className="discussion-heading">Shared lists</h2>
      {lists.length ? (
        lists.map((l) => (
          <button
            key={l.id}
            className="post-subject"
            onClick={() => navigate("list/" + l.postId)}
          >
            <span>
              <strong>{l.title}</strong>
              {JSON.parse(l.itemsJson).length} selected items
            </span>
            <ArrowUpRight size={19} />
          </button>
        ))
      ) : (
        <p className="metadata">No lists shared with this audience yet.</p>
      )}
      {!self && (
        <details className="comparison-details">
          <summary>
            Compare explicitly shared rankings · {overlap.length} overlapping
            items
          </summary>
          {overlap.map(([id, r]) => (
            <div key={id}>
              <span>{subjectTitle(id)}</span>
              <strong>
                You {myShared.get(id)!.score.toFixed(1)} ·{" "}
                {person.name.split(" ")[0]} {r.score.toFixed(1)}
              </strong>
            </div>
          ))}
          {!overlap.length && (
            <p>
              Publish lists with the same items to compare. Private rankings
              aren’t used.
            </p>
          )}
        </details>
      )}
      <h2 className="discussion-heading">
        {self ? "Your event plans" : "Shared event plans"}
      </h2>
      {plans.length ? (
        plans.map((p) => (
          <button
            key={p.eventId}
            className="post-subject"
            onClick={() => navigate("item/" + p.eventId)}
          >
            <span>
              <strong>{subjectTitle(p.eventId)}</strong>
              {p.status === "attending"
                ? "Planning to attend"
                : "Interested"} · {audiences[p.audience]}
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))
      ) : (
        <p className="metadata">No plans to show yet.</p>
      )}
      {self && (
        <>
          <h2 className="discussion-heading">Followed issues</h2>
          {data.follows.map((f) => (
            <button
              key={f.issueId}
              className="issue-rail-row"
              onClick={() => navigate("issue/" + f.issueId)}
            >
              {subjectTitle(f.issueId)}
              <ArrowUpRight size={15} />
            </button>
          ))}
          <button className="text-button" onClick={() => navigate("saved")}>
            Open your private saved items <ArrowRight size={15} />
          </button>
        </>
      )}
      <h2 className="discussion-heading">Published perspectives</h2>
      {children}
    </>
  );
}
export function EditProfile({
  data,
  run,
  onClose,
}: {
  data: Snapshot;
  run: Run;
  onClose: () => void;
}) {
  const [name, setName] = useState(data.me!.name),
    [bio, setBio] = useState(data.me!.bio),
    [communityLabel, setCommunity] = useState(data.me!.communityLabel),
    [error, setError] = useState("");
  return (
    <Modal
      title="Your profile, in your words."
      description="Your displayed community is optional context. It does not change membership or content access."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await run({ action: "profile", name, bio, communityLabel });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please retry.");
          }
        }}
      >
        <label className="social-field">
          Name
          <input
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="social-field">
          Bio
          <textarea
            value={bio}
            rows={3}
            maxLength={300}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label className="social-field">
          Approximate community
          <input
            maxLength={80}
            value={communityLabel}
            onChange={(e) => setCommunity(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary full">Save profile</button>
      </form>
    </Modal>
  );
}
export function Conversation({
  data,
  run,
  navigate,
  onEdit,
  onReport,
  busy,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  onEdit: (p: Post) => void;
  onReport: (id: string) => void;
  busy: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null),
    [edit, setEdit] = useState<string | null>(null);
  const p = data.posts[0];
  if (!p || !data.me) return null;
  const rows = data.comments ?? [];
  return (
    <>
      <button className="text-button" onClick={() => navigate("home")}>
        <ArrowLeft size={15} />
        Back to Home
      </button>
      <PostCard
        post={p}
        me={data.me}
        run={run}
        navigate={navigate}
        onEdit={onEdit}
        onReport={onReport}
        busy={busy}
      />
      {p.authorId === data.me.id && p.kind === "opinion" && (
        <button
          className="text-button"
          onClick={() => onEdit({ ...p, priorPostId: "publish-change" })}
        >
          Publish a change of view <ArrowRight size={15} />
        </button>
      )}
      {data.commentUnavailable && (
        <p className="notice" role="status">
          That reply was deleted or is no longer available. You can still read
          this conversation.
        </p>
      )}
      <h2 className="discussion-heading">
        {p.replyCount} {p.replyCount === 1 ? "reply" : "replies"}
      </h2>
      {rows.map((c) => (
        <div
          className={"comment-row " + (c.parentId ? "nested" : "")}
          id={"comment-" + c.id}
          key={c.id}
        >
          <Avatar
            initials={c.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          />
          <div>
            <button
              className="plain-name"
              onClick={() => navigate("profile/" + c.authorId)}
            >
              {c.name}
            </button>
            <small>
              {new Date(c.createdAt).toLocaleDateString()}
              {c.editedAt ? " · Edited" : ""}
              {c.parentId
                ? " · replying to " +
                  (rows.find((p) => p.id === c.parentId)?.name ??
                    "an earlier reply")
                : ""}
            </small>
            {edit === c.id ? (
              <ReplyComposer
                userId={data.me!.id}
                postId={p.id}
                editing={c}
                run={run}
                onCancel={() => setEdit(null)}
              />
            ) : (
              <p>{c.text}</p>
            )}
            <div className="comment-actions">
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(location.origin + "/#post/" + p.id + "/" + c.id)
                    .then(() => toast.success("Reply link copied."))
                    .catch(() => toast.error("Could not copy the link."));
                }}
              >
                Copy link
              </button>
              {!c.parentId && (
                <button
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                >
                  Reply
                </button>
              )}
              {c.authorId === data.me!.id ? (
                <>
                  <button onClick={() => setEdit(c.id)}>Edit</button>
                  <button onClick={() => onReport("comment-delete:" + c.id)}>
                    Delete
                  </button>
                </>
              ) : (
                <button onClick={() => onReport(c.id)}>Report</button>
              )}
            </div>
            {replyTo === c.id && (
              <ReplyComposer
                userId={data.me!.id}
                postId={p.id}
                parentId={c.id}
                run={run}
                onCancel={() => setReplyTo(null)}
              />
            )}
          </div>
        </div>
      ))}
      <ReplyComposer userId={data.me!.id} postId={p.id} run={run} />
    </>
  );
}
