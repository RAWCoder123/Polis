"use client";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { CommunityEvent, Snapshot } from "@/lib/social/types";
import { eventCategories, eventRecord, eventTime } from "@/lib/social/events";
import { issues } from "@/lib/social/catalog";
import { officialEvents } from "@/lib/social/official-events";
import type { Run, Navigate } from "./social-post";
import { Modal } from "./social-forms";

const blankEvent = (): CommunityEvent => ({
  id: "event-" + crypto.randomUUID(),
  seriesId: "series-" + crypto.randomUUID(),
  title: "",
  description: "",
  organizer: "",
  sourceUrl: "",
  checkedAt: new Date().toISOString(),
  venue: "",
  address: "",
  city: "Ithaca",
  latitude: null,
  longitude: null,
  imageUrl: "",
  startsAt: "",
  endsAt: null,
  timezone: "America/New_York",
  category: "arts_culture",
  cost: "unknown",
  costDetails: "",
  accessibility: "",
  registration: "",
  registrationUrl: "",
  issueId: "",
  status: "draft",
  sample: false,
});
export function EventManager({
  data,
  run,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
}) {
  const [editing, setEditing] = useState<CommunityEvent | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  if (!["owner", "curator"].includes(data.me?.role ?? ""))
    return (
      <div className="event-empty">
        <h1>Curator access required</h1>
        <button
          className="btn secondary"
          onClick={() => navigate("explore/events")}
        >
          Explore events
        </button>
      </div>
    );
  async function action(fn: () => Promise<unknown>) {
    setPending(true);
    setMessage("");
    try {
      await fn();
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="event-manager">
      <button className="text-button" onClick={() => navigate("admin")}>
        <ArrowLeft size={16} />
        Community tools
      </button>
      <h1>Events worth showing up for.</h1>
      <p>
        Publish checked organizer details. Each date is a separate occurrence;
        saves, plans and discussions stay attached to its stable link.
      </p>
      <div className="dialog-actions">
        <button
          className="btn primary"
          onClick={() => setEditing(blankEvent())}
        >
          <Plus size={17} />
          Add an occurrence
        </button>
        <button
          className="btn secondary"
          disabled={pending || !officialEvents.length}
          onClick={() =>
            void action(async () => {
              for (const event of officialEvents)
                await run({ action: "event.save", event, createOnly: true });
            })
          }
        >
          Import {officialEvents.length} checked pilot listings
        </button>
      </div>
      <p className="catalog-notice">
        Import adds only missing IDs. It never overwrites curator edits,
        resurrects canceled listings, or deletes activity.
      </p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <h2>Listings</h2>
      {!data.events.length && (
        <p>No listings yet. Add one or import the checked selection.</p>
      )}
      {data.events.map((e) => (
        <article className="event-manager-row" key={e.id}>
          <div>
            <strong>{e.title}</strong>
            <p>
              {eventTime(e)} · {e.status}
            </p>
            <small>
              {e.seriesId} · {e.id}
            </small>
          </div>
          <div>
            <button className="btn secondary" onClick={() => setEditing(e)}>
              Edit
            </button>
            {e.status !== "published" && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  void action(() =>
                    run({
                      action: "event.status",
                      eventId: e.id,
                      status: "published",
                    }),
                  )
                }
              >
                Publish
              </button>
            )}
            {e.status === "published" && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  void action(() =>
                    run({
                      action: "event.status",
                      eventId: e.id,
                      status: "canceled",
                    }),
                  )
                }
              >
                Cancel occurrence
              </button>
            )}
            {e.status !== "archived" && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  void action(() =>
                    run({
                      action: "event.status",
                      eventId: e.id,
                      status: "archived",
                    }),
                  )
                }
              >
                Archive
              </button>
            )}
            <button
              className="text-button"
              onClick={() => navigate("event/" + e.id)}
            >
              Open
            </button>
          </div>
        </article>
      ))}
      <h2>Suggestions to review</h2>
      {!data.eventSuggestions?.some((s) => s.status === "pending") && (
        <p>No pending suggestions.</p>
      )}
      {data.eventSuggestions
        ?.filter((s) => s.status === "pending")
        .map((s) => (
          <article className="event-manager-row" key={s.id}>
            <div>
              <strong>{s.title}</strong>
              <p>{s.note}</p>
              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                Organizer source
              </a>
            </div>
            <div>
              <button
                className="btn secondary"
                onClick={() =>
                  setEditing({
                    ...blankEvent(),
                    title: s.title,
                    sourceUrl: s.sourceUrl,
                  })
                }
              >
                Prepare listing
              </button>
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  void action(() =>
                    run({
                      action: "event.review",
                      suggestionId: s.id,
                      status: "reviewed",
                    }),
                  )
                }
              >
                Mark reviewed
              </button>
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  void action(() =>
                    run({
                      action: "event.review",
                      suggestionId: s.id,
                      status: "declined",
                    }),
                  )
                }
              >
                Decline
              </button>
            </div>
          </article>
        ))}
      <p>
        Reported listings and discussion feedback appear in the owner’s
        moderation queue in Community tools.
      </p>
      {editing && (
        <EventEditor
          key={editing.id}
          initial={editing}
          run={run}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
function EventEditor({
  initial,
  run,
  onClose,
}: {
  initial: CommunityEvent;
  run: Run;
  onClose: () => void;
}) {
  const [e, setE] = useState(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  function field(key: keyof CommunityEvent, label: string, required = false) {
    return (
      <label className="social-field" key={key}>
        {label}
        <input
          required={required}
          value={String(e[key] ?? "")}
          onChange={(v) => setE((s) => ({ ...s, [key]: v.target.value }))}
        />
      </label>
    );
  }
  async function submit() {
    setPending(true);
    setError("");
    try {
      const iso = (v: string) => {
        if (!/(Z|[+-]\d\d:\d\d)$/.test(v))
          throw new Error(
            "Dates must include a timezone offset, such as -04:00, or Z.",
          );
        return new Date(v).toISOString();
      };
      const record = eventRecord.parse({
        ...e,
        startsAt: iso(e.startsAt),
        endsAt: e.endsAt ? iso(e.endsAt) : null,
        checkedAt: new Date().toISOString(),
      });
      await run({ action: "event.save", event: record });
      onClose();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={initial.title ? "Edit occurrence" : "Add an occurrence"}
      description="Only publish details supported by the organizer. Blank accessibility, cost and end time stay explicitly unknown."
      onClose={onClose}
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
      >
        {field("title", "Title", true)}
        {field("seriesId", "Series ID · reuse for recurring dates", true)}
        <label className="social-field">
          Description
          <textarea
            required
            minLength={10}
            value={e.description}
            onChange={(v) =>
              setE((s) => ({ ...s, description: v.target.value }))
            }
          />
        </label>
        {field("organizer", "Organizer", true)}
        {field("sourceUrl", "Official HTTPS source", true)}
        <label className="social-field">
          Category
          <select
            value={e.category}
            onChange={(v) =>
              setE((s) => ({
                ...s,
                category: v.target.value as CommunityEvent["category"],
              }))
            }
          >
            {Object.entries(eventCategories).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>When and where</legend>
          {field("startsAt", "Start · ISO date with offset", true)}
          {field("endsAt", "End · optional ISO date with offset")}
          <p>
            Example: 2026-09-25T12:00:00-04:00. New York uses -04:00 in
            September and -05:00 after the November clock change.
          </p>
          {field("timezone", "IANA timezone", true)}
          {field("venue", "Venue", true)}
          {field("address", "Address")}
          {field("city", "City", true)}
          <div className="event-editor-pair">
            {(["latitude", "longitude"] as const).map((key) => (
              <label className="social-field" key={key}>
                Venue {key} · only when verified
                <input
                  type="number"
                  step="any"
                  value={e[key] ?? ""}
                  onChange={(v) =>
                    setE((s) => ({
                      ...s,
                      [key]:
                        v.target.value === "" ? null : Number(v.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="social-field">
          Cost
          <select
            value={e.cost}
            onChange={(v) =>
              setE((s) => ({
                ...s,
                cost: v.target.value as CommunityEvent["cost"],
              }))
            }
          >
            <option value="unknown">Not supplied</option>
            <option value="free">Free entry</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        {field("costDetails", "Cost details")}
        {field("registration", "Registration or ticket requirements")}
        {field("registrationUrl", "Registration HTTPS link")}
        {field("accessibility", "Accessibility · only if supplied")}
        {field("imageUrl", "Organizer image HTTPS URL · optional")}
        <label className="social-field">
          Related issue · optional
          <select
            value={e.issueId}
            onChange={(v) => setE((s) => ({ ...s, issueId: v.target.value }))}
          >
            <option value="">No related issue</option>
            {issues.map((i) => (
              <option value={i.id} key={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="social-field">
          Status
          <select
            value={e.status}
            onChange={(v) =>
              setE((s) => ({
                ...s,
                status: v.target.value as CommunityEvent["status"],
              }))
            }
          >
            {["draft", "published", "canceled", "archived"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="event-check">
          <input
            type="checkbox"
            checked={e.sample}
            onChange={(v) => setE((s) => ({ ...s, sample: v.target.checked }))}
          />
          This is a synthetic test fixture
        </label>
        {error && (
          <p className="social-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" disabled={pending}>
          Save occurrence
        </button>
      </form>
    </Modal>
  );
}
