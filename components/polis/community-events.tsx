"use client";
import "./community-events.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  MapPin,
  SlidersHorizontal,
  LocateFixed,
  Star,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Audience,
  CommunityEvent,
  EventCategory,
  Snapshot,
} from "@/lib/social/types";
import {
  discoverEvents,
  eventCategories,
  eventExpired,
  eventTime,
} from "@/lib/social/events";
import { communityEventCalendar } from "@/lib/social/calendar";
import type { Run, Navigate } from "./social-post";
import { Modal } from "./social-forms";
import VenueMap from "./venue-map";

type Props = { data: Snapshot; run: Run; navigate: Navigate };
const costLabel = (e: CommunityEvent) =>
  e.cost === "free"
    ? "Free entry"
    : e.cost === "paid"
      ? e.costDetails || "Paid · check organizer"
      : "Cost not supplied";
function EventImage({ event }: { event: CommunityEvent }) {
  const [failed, setFailed] = useState(false);
  return event.imageUrl && !failed ? (
    <img
      className="event-image"
      src={event.imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={"event-image event-image-fallback cat-" + event.category}>
      <CalendarDays size={30} />
      <span>{eventCategories[event.category]}</span>
    </div>
  );
}
export function EventCard({
  event,
  data,
  run,
  navigate,
  reason,
  selected,
  onSelect,
}: {
  event: CommunityEvent;
  reason?: string;
  selected?: boolean;
  onSelect?: () => void;
} & Props) {
  const [pending, setPending] = useState(false),
    saved = data.saved.includes(event.id);
  const friends = data.plans.filter(
    (p) =>
      p.eventId === event.id &&
      p.userId !== data.me?.id &&
      data.people.some(
        (u) =>
          u.id === p.userId &&
          u.relationship === "friends" &&
          !u.blocked &&
          !u.muted,
      ),
  );
  async function save() {
    setPending(true);
    try {
      await run({ action: "save", targetId: event.id, enabled: !saved });
      toast.success(
        saved ? "Event removed from saved." : "Event saved privately.",
      );
    } catch {
    } finally {
      setPending(false);
    }
  }
  return (
    <article
      id={"event-card-" + event.id}
      className={"community-event-card " + (selected ? "selected" : "")}
    >
      <button
        className="event-card-open"
        onClick={() => navigate("event/" + event.id)}
      >
        <EventImage event={event} />
        <span className="event-card-copy">
          <small>
            {eventCategories[event.category]}
            {event.sample ? " · Sample" : ""}
          </small>
          <h2>{event.title}</h2>
          <span>{eventTime(event)}</span>
          <span>
            <MapPin size={14} />
            {event.venue}
          </span>
          <strong>{costLabel(event)}</strong>
        </span>
      </button>
      {reason && (
        <p className="event-reason">
          <Star size={13} />
          {reason}
        </p>
      )}
      {friends.length > 0 && (
        <p className="event-friends">
          {friends.map((f) => f.name).join(", ")}{" "}
          {friends.length === 1 ? "has" : "have"} shared a plan
        </p>
      )}
      <div className="event-card-actions">
        <button
          className="text-button"
          disabled={pending}
          aria-pressed={saved}
          onClick={() => void save()}
        >
          <Bookmark size={17} />
          {saved ? "Saved" : "Save"}
        </button>
        {onSelect && (
          <button
            className="text-button"
            onClick={onSelect}
            aria-pressed={!!selected}
          >
            <MapPin size={16} />
            Show venue
          </button>
        )}
        <button
          className="text-button"
          onClick={() => navigate("event/" + event.id)}
        >
          Details <ArrowUpRight size={16} />
        </button>
      </div>
    </article>
  );
}
export function EventInterests({
  data,
  run,
  onClose,
}: {
  data: Snapshot;
  run: Run;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<EventCategory[]>(
      data.eventPreferences.interests,
    ),
    [city, setCity] = useState(data.eventPreferences.city),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function save(skip = false) {
    setPending(true);
    setError("");
    try {
      await run({
        action: "event.preferences",
        city,
        interests: skip ? [] : selected,
        complete: true,
      });
      onClose();
      toast.success(
        skip ? "You can choose interests later." : "Event interests saved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title="Make room for what you enjoy"
      description="Choose event interests to guide discovery. These are separate from your civic priorities and political views."
      onClose={onClose}
    >
      <label className="social-field">
        City
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={80}
        />
      </label>
      <div className="interest-options">
        {Object.entries(eventCategories).map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={selected.includes(id as EventCategory)}
              onChange={() =>
                setSelected((s) =>
                  s.includes(id as EventCategory)
                    ? s.filter((x) => x !== id)
                    : [...s, id as EventCategory],
                )
              }
            />
            {label}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="social-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="btn secondary"
          disabled={pending}
          onClick={() => void save(true)}
        >
          Skip for now
        </button>
        <button
          className="btn primary"
          disabled={pending || city.trim().length < 2}
          onClick={() => void save()}
        >
          Save interests
        </button>
      </div>
    </Modal>
  );
}
export function EventSuggestionForm({
  run,
  onClose,
}: {
  run: Run;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [note, setNote] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Suggest an event"
      description="Share the organizer’s listing. A curator reviews suggestions before publication."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            await run({ action: "event.suggest", title, sourceUrl: url, note });
            toast.success("Suggestion sent for review.");
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="social-field">
          Title
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="social-field">
          Organizer’s HTTPS link
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="social-field">
          Anything the curator should know?{" "}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="btn primary" disabled={pending}>
          Send suggestion
        </button>
      </form>
    </Modal>
  );
}
export function CommunityEvents({
  data,
  run,
  navigate,
  params,
  query,
  collection,
}: { params?: URLSearchParams; query?: string; collection?: string } & Props) {
  const p = params ?? new URLSearchParams();
  const [interests, setInterests] = useState(false),
    [suggest, setSuggest] = useState(false),
    [origin, setOrigin] = useState<[number, number] | undefined>(),
    [locationMessage, setLocationMessage] = useState("");
  const city = p.get("city") ?? data.eventPreferences.city,
    mode = p.get("mode") ?? "list",
    selected = p.get("selected") ?? "";
  const base = collection
    ? "event-collections/" + collection
    : "explore/events";
  useEffect(() => {
    if (selected && mode === "map")
      document
        .getElementById("event-card-" + selected)
        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [selected, mode]);
  function update(key: string, value: string) {
    const next = new URLSearchParams(p);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(base + (next.size ? "?" + next : ""));
  }
  // City centers are not device locations. Precise device coordinates never leave this component.
  const nearbyOrigin =
    origin ??
    (city.toLowerCase() === "ithaca"
      ? ([42.444, -76.498] as [number, number])
      : undefined);
  const visible = discoverEvents(
    data.events.filter(
      (e) =>
        !collection ||
        (collection === "saved"
          ? data.saved.includes(e.id)
          : data.plans.some(
              (plan) =>
                plan.eventId === e.id &&
                plan.userId === data.me?.id &&
                plan.status === collection,
            )),
    ),
    data.eventPreferences,
    {
      q: query ?? p.get("q") ?? "",
      city,
      period: p.get("period") ?? "",
      from: p.get("from") ?? "",
      to: p.get("to") ?? "",
      category: p.get("category") ?? "",
      free: p.get("free") === "1",
      miles: Number(p.get("miles")) || undefined,
      sort: p.get("sort") ?? "recommended",
      origin: nearbyOrigin,
    },
  );
  const mapEvents = visible.map((r) => r.event);
  async function locate() {
    setLocationMessage("Finding your location…");
    if (!navigator.geolocation) {
      setLocationMessage("Location is unavailable. Browse by city instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin([pos.coords.latitude, pos.coords.longitude]);
        setLocationMessage("Using your location on this device only.");
      },
      () =>
        setLocationMessage(
          "Location was not shared. You can still browse by city.",
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  return (
    <div className="community-events">
      <div className="events-view-tabs">
        <button className="active" onClick={() => navigate("explore/events")}>
          Events
        </button>
        <button onClick={() => navigate("explore/issues")}>Issues</button>
        <span />
        <button onClick={() => setInterests(true)}>
          <SlidersHorizontal size={16} />
          Your interests
        </button>
      </div>
      {collection && (
        <h2>
          {collection === "saved"
            ? "Saved events"
            : collection === "attending"
              ? "Going"
              : "Interested"}
          <small> · Your private collection</small>
        </h2>
      )}
      <div className="event-discovery-toolbar">
        <label>
          City
          <input
            aria-label="Discovery city"
            defaultValue={city}
            key={city}
            onBlur={(e) => {
              if (e.target.value.trim()) update("city", e.target.value.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </label>
        <button className="text-button" onClick={() => void locate()}>
          <LocateFixed size={16} />
          Use my location
        </button>
        <label>
          When
          <select
            value={p.get("period") ?? ""}
            onChange={(e) => update("period", e.target.value)}
          >
            <option value="">Upcoming</option>
            <option value="today">Today</option>
            <option value="weekend">This weekend</option>
            <option value="range">Date range</option>
          </select>
        </label>
        <label>
          Category
          <select
            value={p.get("category") ?? ""}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="">All interests</option>
            {Object.entries(eventCategories).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="event-check">
          <input
            type="checkbox"
            checked={p.get("free") === "1"}
            onChange={(e) => update("free", e.target.checked ? "1" : "")}
          />
          Free
        </label>
        <label>
          Distance
          <select
            value={p.get("miles") ?? ""}
            onChange={(e) => update("miles", e.target.value)}
            disabled={!nearbyOrigin}
          >
            <option value="">Any distance</option>
            <option value="1">Within 1 mile</option>
            <option value="3">Within 3 miles</option>
            <option value="10">Within 10 miles</option>
            <option value="25">Within 25 miles</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={p.get("sort") ?? "recommended"}
            onChange={(e) => update("sort", e.target.value)}
          >
            <option value="recommended">For you</option>
            <option value="date">Date</option>
            <option value="distance">Distance</option>
          </select>
        </label>
      </div>
      {p.get("period") === "range" && (
        <div className="event-date-range">
          <label>
            From
            <input
              type="date"
              value={p.get("from") ?? ""}
              onChange={(e) => update("from", e.target.value)}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={p.get("to") ?? ""}
              onChange={(e) => update("to", e.target.value)}
            />
          </label>
        </div>
      )}
      {locationMessage && <p role="status">{locationMessage}</p>}
      <div className="events-result-header">
        <p>
          {visible.length} upcoming {visible.length === 1 ? "event" : "events"}{" "}
          ·{" "}
          {origin
            ? "Near your location"
            : nearbyOrigin
              ? "Distance from central Ithaca"
              : "Selected city"}
        </p>
        <div className="event-mode-switch">
          <button
            aria-pressed={mode === "list"}
            onClick={() => update("mode", "list")}
          >
            List
          </button>
          <button
            aria-pressed={mode === "map"}
            onClick={() => update("mode", "map")}
          >
            Map
          </button>
        </div>
      </div>
      <div className={mode === "map" ? "event-map-results" : ""}>
        {mode === "map" && (
          <VenueMap
            events={mapEvents}
            selected={selected}
            onSelect={(id) => update("selected", id)}
          />
        )}
        <div className="community-event-grid">
          {visible.map(({ event, distance, match }) => (
            <EventCard
              key={event.id}
              event={event}
              data={data}
              run={run}
              navigate={navigate}
              selected={selected === event.id}
              onSelect={
                mode === "map" && event.latitude !== null
                  ? () => update("selected", event.id)
                  : undefined
              }
              reason={
                match
                  ? "Matches your interest in " +
                    eventCategories[event.category].toLowerCase()
                  : distance !== null
                    ? distance.toFixed(1) + " miles away"
                    : undefined
              }
            />
          ))}
        </div>
      </div>
      {!visible.length && (
        <div className="event-empty">
          <CalendarDays size={32} />
          <h2>No upcoming events match yet.</h2>
          <p>
            Try a wider date range or distance. Saved events that ended remain
            in your history below.
          </p>
          <button className="btn secondary" onClick={() => navigate(base)}>
            Clear filters
          </button>
        </div>
      )}
      {collection && (
        <details className="event-history">
          <summary>Past, canceled and archived events</summary>
          {data.events
            .filter((e) =>
              collection === "saved"
                ? data.saved.includes(e.id)
                : data.plans.some(
                    (plan) =>
                      plan.eventId === e.id &&
                      plan.userId === data.me?.id &&
                      plan.status === collection,
                  ),
            )
            .filter((e) => e.status !== "published" || eventExpired(e))
            .map((e) => (
              <button
                key={e.id}
                className="catalog-row"
                onClick={() => navigate("event/" + e.id)}
              >
                {e.title} · {e.status === "published" ? "Ended" : e.status}
              </button>
            ))}
        </details>
      )}
      <div className="event-footer">
        <p>
          Details come from organizers. Check the original listing before
          traveling.
        </p>
        <button className="text-button" onClick={() => setSuggest(true)}>
          Suggest an event <ArrowUpRight size={16} />
        </button>
      </div>
      {interests && (
        <EventInterests
          data={data}
          run={run}
          onClose={() => setInterests(false)}
        />
      )}{" "}
      {suggest && (
        <EventSuggestionForm run={run} onClose={() => setSuggest(false)} />
      )}
    </div>
  );
}
export function AroundEvents({ data, run, navigate }: Props) {
  const events = discoverEvents(data.events, data.eventPreferences).slice(0, 3);
  return (
    <section className="around-events">
      <div className="events-result-header">
        <h2>Around the corner</h2>
        <button
          className="text-button"
          onClick={() => navigate("explore/events")}
        >
          See all <ArrowUpRight size={15} />
        </button>
      </div>
      {!events.length ? (
        <p>New community events will appear here as curators publish them.</p>
      ) : (
        events.map(({ event }) => (
          <button
            key={event.id}
            className="around-event"
            onClick={() => navigate("event/" + event.id)}
          >
            <CalendarDays size={22} />
            <span>
              <strong>{event.title}</strong>
              <small>{eventTime(event)}</small>
            </span>
          </button>
        ))
      )}
      {!data.eventPreferences.complete && (
        <EventInterestPrompt data={data} run={run} />
      )}
    </section>
  );
}
function EventInterestPrompt({ data, run }: { data: Snapshot; run: Run }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        Choose event interests · optional
      </button>
      {open && (
        <EventInterests data={data} run={run} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
export function EventCollections({ data, run, navigate }: Props) {
  return (
    <section className="event-collections">
      <h2>Your community life</h2>
      <div>
        {[
          ["saved", "Saved"],
          ["interested", "Interested"],
          ["attending", "Going"],
        ].map(([id, label]) => (
          <button
            className="btn secondary"
            key={id}
            onClick={() => navigate("event-collections/" + id)}
          >
            {label}
          </button>
        ))}
      </div>
      <EventInterestPrompt data={data} run={run} />
    </section>
  );
}
export function CommunityEventDetail({
  id,
  data,
  run,
  navigate,
  compose,
  report,
  children,
}: {
  id: string;
  compose: (options: {
    subjectId: string;
    kind: "event_share" | "question";
  }) => void;
  report: (id: string) => void;
  children: React.ReactNode;
} & Props) {
  const event = data.events.find((e) => e.id === id),
    plan = data.plans.find((p) => p.eventId === id && p.userId === data.me?.id);
  const [audience, setAudience] = useState<Audience>(
      plan?.audience ?? "only_me",
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const opened = useRef("");
  useEffect(() => {
    if (event && event.status !== "draft" && opened.current !== event.id) {
      opened.current = event.id;
      // Best-effort measurement must not occupy the foreground write lock or
      // refresh the page while someone is saving a plan.
      void fetch("/api/polis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          data: { action: "event.metric", eventId: event.id, kind: "event_open" },
        }),
      }).catch(() => {});
    }
  }, [event]);
  if (!event)
    return (
      <div className="event-empty">
        <h1>This event is unavailable.</h1>
        <p>It may be unpublished or outside your community.</p>
        <button
          className="btn secondary"
          onClick={() => navigate("explore/events")}
        >
          Explore events
        </button>
      </div>
    );
  if (event.status === "draft")
    return (
      <article className="community-event-detail">
        <button
          className="text-button"
          onClick={() => navigate("event-manager")}
        >
          <ArrowLeft size={16} /> Manage listings
        </button>
        <p className="social-section-label">Draft preview · Curators only</p>
        <h1>{event.title}</h1>
        <p className="event-status">
          This occurrence is not published. Publish it from Manage listings to
          enable saves, plans and discussions.
        </p>
        <EventImage event={event} />
        <p className="event-description">{event.description}</p>
        <p>{eventTime(event)}</p>
        <p>
          {event.venue} · {event.address}
        </p>
        <p>
          {event.organizer} · {costLabel(event)}
        </p>
        <a
          className="text-button"
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Original organizer listing <ArrowUpRight size={16} />
        </a>
      </article>
    );
  const active = event.status === "published" && !eventExpired(event),
    saved = data.saved.includes(id);
  const friends = data.plans.filter(
    (p) =>
      p.eventId === id &&
      p.userId !== data.me?.id &&
      data.people.some(
        (u) =>
          u.id === p.userId &&
          u.relationship === "friends" &&
          !u.blocked &&
          !u.muted,
      ),
  );
  async function act(fn: () => Promise<unknown>) {
    setPending(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setPending(false);
    }
  }
  async function change(status: "interested" | "attending" | null) {
    await act(async () => {
      await run({ action: "plan", eventId: id, status, audience });
      toast.success(
        status ? "Plan saved. Registration is separate." : "Plan removed.",
      );
    });
  }
  return (
    <article className="community-event-detail">
      <button
        className="text-button"
        onClick={() => navigate("explore/events")}
      >
        <ArrowLeft size={16} />
        All events
      </button>
      <p className="social-section-label">
        {eventCategories[event.category]}
        {event.sample ? " · Sample" : ""}
      </p>
      <h1>{event.title}</h1>
      {!active && (
        <p className="event-status" role="status">
          {event.status === "canceled"
            ? "Canceled by the organizer or curator."
            : event.status === "archived"
              ? "This event has been archived."
              : "This occurrence has ended."}{" "}
          Your saved record remains available.
        </p>
      )}
      <EventImage event={event} />
      <p className="event-description">{event.description}</p>
      <dl className="event-facts">
        <dt>When</dt>
        <dd>
          {eventTime(event)}
          <small>{event.timezone}</small>
        </dd>
        <dt>Where</dt>
        <dd>
          {event.venue}
          <small>{event.address}</small>
        </dd>
        <dt>Organizer</dt>
        <dd>{event.organizer}</dd>
        <dt>Cost</dt>
        <dd>
          {costLabel(event)}
          {event.costDetails && event.cost !== "paid" && (
            <small>{event.costDetails}</small>
          )}
        </dd>
        <dt>Accessibility</dt>
        <dd>
          {event.accessibility ||
            "Not supplied. Contact the organizer for access details."}
        </dd>
        <dt>Registration</dt>
        <dd>
          {event.registration ||
            "Requirements not supplied; check the organizer."}
          {event.registrationUrl && (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Registration or tickets <ArrowUpRight size={14} />
            </a>
          )}
        </dd>
      </dl>
      <a
        className="text-button"
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Original organizer listing <ArrowUpRight size={16} />
      </a>
      <p className="event-source-date">
        Details checked{" "}
        {new Date(event.checkedAt).toLocaleDateString("en-US", {
          timeZone: event.timezone,
        })}
        .
      </p>
      <section className="event-action-panel">
        <button
          className="btn secondary"
          disabled={pending}
          aria-pressed={saved}
          onClick={() =>
            void act(() =>
              run({ action: "save", targetId: id, enabled: !saved }),
            )
          }
        >
          <Bookmark size={17} />
          {saved ? "Saved · Undo" : "Save privately"}
        </button>
        <a
          className="btn secondary"
          download={"polis-" + event.id + ".ics"}
          href={
            "data:text/calendar;charset=utf-8," +
            encodeURIComponent(communityEventCalendar(event))
          }
        >
          <CalendarDays size={17} />
          Add to calendar
        </a>
        <button
          className="btn secondary"
          onClick={() =>
            void act(async () => {
              await navigator.clipboard.writeText(location.href);
              toast.success("Event link copied.");
              await run({
                action: "event.metric",
                eventId: id,
                kind: "event_share",
              });
            })
          }
        >
          Copy event link
        </button>
        <label className="social-field">
          Attendance visibility
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
          >
            <option value="only_me">Private · Only me</option>
            <option value="friends">Friends</option>
            <option value="community">Community · Invited members</option>
          </select>
        </label>
        <p>
          Going records your intention. It does not complete registration or buy
          a ticket. Community sharing stays inside this invited pilot.
        </p>
        <div className="event-rsvp-buttons">
          <button
            className={
              "btn " + (plan?.status === "interested" ? "primary" : "secondary")
            }
            disabled={pending || !active}
            aria-pressed={plan?.status === "interested"}
            onClick={() => void change("interested")}
          >
            Interested
          </button>
          <button
            className={
              "btn " + (plan?.status === "attending" ? "primary" : "secondary")
            }
            disabled={pending || !active}
            aria-pressed={plan?.status === "attending"}
            onClick={() => void change("attending")}
          >
            Going
          </button>
          {plan && (
            <button
              className="text-button"
              disabled={pending}
              onClick={() => void change(null)}
            >
              Remove plan
            </button>
          )}
        </div>
        {plan && (
          <p className="event-plan-confirmed">
            <Check size={16} />
            Saved: {plan.status === "attending" ? "Going" : "Interested"} ·{" "}
            {plan.audience === "only_me"
              ? "Private"
              : plan.audience === "friends"
                ? "Friends"
                : "Community"}
            {audience !== plan.audience && (
              <button
                disabled={pending}
                className="text-button"
                onClick={() => void change(plan.status)}
              >
                Save new visibility
              </button>
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="social-error">
            {error}
          </p>
        )}
      </section>
      <section>
        <h2>Friends’ plans</h2>
        {friends.length ? (
          friends.map((p) => (
            <p key={p.userId}>
              <button
                className="text-button"
                onClick={() => navigate("profile/" + p.userId)}
              >
                {p.name}
              </button>{" "}
              · {p.status === "attending" ? "Going" : "Interested"}
            </p>
          ))
        ) : (
          <p>No friends have shared a plan you can see.</p>
        )}
      </section>
      {event.issueId && (
        <button
          className="text-button"
          onClick={() => navigate("issue/" + event.issueId)}
        >
          Explore the related issue <ArrowUpRight size={16} />
        </button>
      )}
      <section className="event-discussion">
        <div className="events-result-header">
          <h2>The conversation</h2>
          <button
            className="btn primary"
            onClick={() => compose({ subjectId: id, kind: "question" })}
          >
            <Send size={16} />
            Start a conversation
          </button>
        </div>
        <p>
          Choose an audience when you post. Replies stay within that
          conversation’s audience.
        </p>
        <button
          className="text-button"
          onClick={() => compose({ subjectId: id, kind: "event_share" })}
        >
          Share this event with a note
        </button>
        {children}
      </section>
      <button className="text-button" onClick={() => report(id)}>
        Report listing
      </button>
    </article>
  );
}
