"use client";
import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  Clock3,
  List,
  Lock,
  Map,
  MapPin,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { items, itemById, type CivicItem } from "@/lib/polis-data";
import { issueFor } from "@/lib/social/catalog";
import { audiences, type Snapshot } from "@/lib/social/types";
import CommunityMap from "./community-map";
import { EventPlanEditor } from "./event-plan";
import { Modal } from "./social-forms";
import type { Navigate, Run } from "./social-post";

const eventTypes = ["All types", "Town halls", "Volunteering", "Meetups"];
export default function EventExplorer({
  data,
  run,
  selectedId,
  params,
  navigate,
  explore,
}: {
  data: Snapshot;
  run: Run;
  selectedId?: string;
  params: URLSearchParams;
  navigate: Navigate;
  explore: (route: string) => void;
}) {
  const [planning, setPlanning] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const type = eventTypes.includes(params.get("type") ?? "")
    ? params.get("type")!
    : "All types";
  const day = ["12", "13", "14", "15"].includes(params.get("day") ?? "")
    ? params.get("day")!
    : "all";
  const scope = ["mine", "friends", "saved"].includes(params.get("scope") ?? "")
    ? params.get("scope")!
    : "all";
  const layout = params.get("layout") === "list" ? "list" : "map";
  const query = params.get("q") ?? "";
  const friends = new Set(
    data.people
      .filter((p) => p.relationship === "friends" && !p.blocked)
      .map((p) => p.id),
  );
  const myPlans = data.plans.filter((p) => p.userId === data.me?.id);
  const friendPlans = data.plans.filter((p) => friends.has(p.userId));
  const events = items
    .filter(
      (i) =>
        i.event &&
        (type === "All types" || i.event.type === type) &&
        (day === "all" || i.event.day === day) &&
        (scope === "all" ||
          (scope === "saved"
            ? data.saved.includes(i.id)
            : (scope === "mine" ? myPlans : friendPlans).some(
                (p) => p.eventId === i.id,
              ))) &&
        (!query ||
          (i.title + " " + i.topic + " " + i.summary + " " + i.event.place)
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .sort((a, b) => Number(a.event!.day) - Number(b.event!.day));
  const selected = events.find((i) => i.id === selectedId);
  const participants = Object.fromEntries(
    events.map((i) => [
      i.id,
      friendPlans
        .filter((p) => p.eventId === i.id)
        .map((p) => ({
          name: p.name,
          initials: p.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join(""),
        })),
    ]),
  );
  function route(next: Record<string, string | null>, id = selectedId) {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) =>
      v === null ? p.delete(k) : p.set(k, v),
    );
    explore("explore/events" + (id ? "/" + id : "") + (p.size ? "?" + p : ""));
  }
  function select(item: CivicItem) {
    setFocusRequest((request) => request + 1);
    route({}, item.id);
  }
  function open(item: CivicItem) {
    navigate("item/" + item.id);
  }
  const activeFilters =
    type !== "All types" || day !== "all" || scope !== "all" || !!query;
  function planLabel(item: CivicItem) {
    const mine = myPlans.find((p) => p.eventId === item.id);
    return mine
      ? mine.status === "attending"
        ? "Planning to attend"
        : "Interested"
      : "Make a plan";
  }
  const selectedFriends = selected
    ? friendPlans.filter((p) => p.eventId === selected.id)
    : [];
  return (
    <section className="event-explorer" aria-label="Event discovery">
      <div className="event-discovery-heading">
        <div>
          <p>Find a gathering around an issue you care about.</p>
        </div>
        <div className="event-view-switch" role="group" aria-label="Event view">
          <button
            aria-pressed={layout === "map"}
            onClick={() => route({ layout: null })}
          >
            <Map size={16} />
            Map
          </button>
          <button
            aria-pressed={layout === "list"}
            onClick={() => route({ layout: "list" })}
          >
            <List size={16} />
            List
          </button>
        </div>
      </div>
      <div className="event-filter-bar">
        <SlidersHorizontal size={17} aria-hidden="true" />
        <label>
          Event type
          <select
            value={type}
            onChange={(e) =>
              route(
                {
                  type: e.target.value === "All types" ? null : e.target.value,
                },
                "",
              )
            }
          >
            {eventTypes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sample date
          <select
            value={day}
            onChange={(e) =>
              route(
                { day: e.target.value === "all" ? null : e.target.value },
                "",
              )
            }
          >
            <option value="all">All dates</option>
            {["12", "13", "14", "15"].map((d) => (
              <option key={d} value={d}>
                Sep {d}, 2026
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select
            value={scope}
            onChange={(e) =>
              route(
                { scope: e.target.value === "all" ? null : e.target.value },
                "",
              )
            }
          >
            <option value="all">All events</option>
            <option value="mine">My plans</option>
            <option value="saved">Saved privately</option>
            <option value="friends">Friends’ shared plans</option>
          </select>
        </label>
        {activeFilters && (
          <button
            className="text-button"
            onClick={() =>
              explore(
                "explore/events" + (layout === "list" ? "?layout=list" : ""),
              )
            }
          >
            Clear filters
            <X size={14} />
          </button>
        )}
      </div>
      <div className="event-result-line">
        <span role="status">
          {events.length} {events.length === 1 ? "event" : "events"}
          {activeFilters
            ? events.length === 1
              ? " matches your filters"
              : " match your filters"
            : " to explore"}
        </span>
        <span>Sample week · September 12–15, 2026</span>
      </div>
      <div
        className={"event-workspace " + (layout === "list" ? "list-only" : "")}
      >
        {layout === "map" && (
          <div className="event-map-panel">
            <CommunityMap
              visibleItems={events}
              selected={selected?.id}
              focusRequest={focusRequest}
              onSelect={select}
              participants={participants}
              plannedIds={myPlans.map((p) => p.eventId)}
            />
            {selected ? (
              <section
                className="event-map-preview"
                aria-label="Selected event"
                aria-live="polite"
              >
                <div className="event-preview-top">
                  <span className="event-category">
                    {selected.event!.type} · {selected.topic}
                  </span>
                  <button
                    className="icon-btn"
                    aria-label="Close event preview"
                    onClick={() => route({}, "")}
                  >
                    <X size={16} />
                  </button>
                </div>
                <h3>{selected.title}</h3>
                <div className="event-preview-facts">
                  <span>
                    <CalendarDays size={15} />
                    Sep {selected.event!.day} · {selected.event!.time} ET
                  </span>
                  <span>
                    <MapPin size={15} />
                    {selected.event!.place}
                  </span>
                </div>
                <p>{selected.subtitle}</p>
                {selectedFriends.length > 0 && (
                  <p className="event-friend-summary">
                    <Users size={14} />
                    {selectedFriends
                      .map(
                        (p) =>
                          p.name +
                          " · " +
                          (p.status === "attending"
                            ? "planning to attend"
                            : "interested"),
                      )
                      .join("; ")}
                  </p>
                )}
                <div className="event-preview-actions">
                  <button
                    className="btn primary"
                    onClick={() => setPlanning(selected.id)}
                  >
                    {myPlans.some((p) => p.eventId === selected.id) ? (
                      <Check size={15} />
                    ) : (
                      <CalendarDays size={15} />
                    )}{" "}
                    {planLabel(selected)}
                  </button>
                  <button
                    className="btn secondary"
                    aria-pressed={data.saved.includes(selected.id)}
                    onClick={() => {
                      void run({
                        action: "save",
                        targetId: selected.id,
                        enabled: !data.saved.includes(selected.id),
                      }).catch(() => {});
                    }}
                  >
                    <Bookmark size={15} />
                    {data.saved.includes(selected.id)
                      ? "Saved privately"
                      : "Save privately"}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => open(selected)}
                  >
                    Event details
                    <ArrowRight size={15} />
                  </button>
                </div>
                <button
                  className="text-button event-issue-link"
                  onClick={() => navigate("issue/" + issueFor(selected.id)!.id)}
                >
                  Explore {issueFor(selected.id)!.name.toLowerCase()}
                  <ArrowRight size={14} />
                </button>
                <small>Sample location · No real registration available.</small>
              </section>
            ) : (
              <div className="event-map-intro">
                <MapPin size={22} />
                <div>
                  <strong>
                    {events.length
                      ? "Pick a pin. Find a reason to go."
                      : "A little quiet in this view."}
                  </strong>
                  <p>
                    {events.length
                      ? "Preview an event here, then decide who sees your plan."
                      : "Change a filter to find another gathering."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="event-results" aria-label="Matching events">
          {events.map((item) => {
            const mine = myPlans.find((p) => p.eventId === item.id),
              shared = friendPlans.filter((p) => p.eventId === item.id);
            return (
              <article
                key={item.id}
                className={
                  "event-result-card " +
                  (selected?.id === item.id ? "is-selected" : "")
                }
              >
                <button
                  className="event-result-main"
                  aria-label={
                    (layout === "map" ? "Preview " : "Open ") + item.title
                  }
                  aria-pressed={
                    layout === "map" ? selected?.id === item.id : undefined
                  }
                  onClick={() => (layout === "map" ? select(item) : open(item))}
                >
                  <span className="event-card-date">
                    <strong>{item.event!.day}</strong>
                    <small>SEP</small>
                  </span>
                  <span>
                    <span className="event-category">{item.event!.type}</span>
                    <h3>{item.title}</h3>
                    <span className="event-card-fact">
                      <Clock3 size={13} />
                      {item.event!.time} ET
                    </span>
                    <span className="event-card-fact">
                      <MapPin size={13} />
                      {item.event!.place}
                    </span>
                  </span>
                </button>
                {shared.length > 0 && (
                  <p className="event-card-social">
                    <Users size={13} />
                    {shared.length}{" "}
                    {shared.length === 1 ? "friend has" : "friends have"} shared
                    a plan
                  </p>
                )}
                {mine && (
                  <p className="event-card-social">
                    <Check size={13} />
                    {planLabel(item)} · {audiences[mine.audience]}
                  </p>
                )}
                <div className="event-card-actions">
                  <button
                    className="text-button"
                    aria-pressed={data.saved.includes(item.id)}
                    onClick={() => {
                      void run({
                        action: "save",
                        targetId: item.id,
                        enabled: !data.saved.includes(item.id),
                      }).catch(() => {});
                    }}
                  >
                    <Bookmark size={14} />
                    {data.saved.includes(item.id) ? "Saved" : "Save privately"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setPlanning(item.id)}
                  >
                    {mine ? "Edit plan" : "Make a plan"}
                  </button>
                  <button className="text-button" onClick={() => open(item)}>
                    Details
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
          {!events.length && (
            <div className="event-empty">
              <CalendarDays size={28} />
              <h3>No gatherings in this view.</h3>
              <p>
                {scope === "mine"
                  ? "Your saved plans will appear here. Explore all events to find one."
                  : scope === "friends"
                    ? "Your friends haven’t shared matching plans with you yet."
                    : scope === "saved"
                      ? "Events you save privately will appear here. Saving is separate from a plan or registration."
                      : "Try another date, event type, or search."}
              </p>
              <button
                className="btn secondary"
                onClick={() => explore("explore/events")}
              >
                Show all events
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="event-privacy-note">
        <Lock size={14} />
        Your plans start private. Friend indicators show only plans shared with
        you, never live locations.
      </p>
      {planning && itemById[planning] && (
        <Modal
          title="Your plan"
          description={itemById[planning].title + " · Sample event"}
          onClose={() => setPlanning(null)}
        >
          <EventPlanEditor
            key={planning}
            eventId={planning}
            data={data}
            run={run}
          />
        </Modal>
      )}
    </section>
  );
}
