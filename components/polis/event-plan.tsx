"use client";
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { AudienceField } from "./social-forms";
import {
  audiences,
  type Audience,
  type EventPlanStatus,
  type Snapshot,
} from "@/lib/social/types";
import type { Run } from "./social-post";

export function EventPlanEditor({
  eventId,
  data,
  run,
}: {
  eventId: string;
  data: Snapshot;
  run: Run;
}) {
  const mine = data.plans.find(
    (p) => p.eventId === eventId && p.userId === data.me?.id,
  );
  // A null draft follows the persisted plan, including changes from another view.
  // Active edits remain intact during polling and failed writes.
  const [draft, setDraft] = useState<{
    status: EventPlanStatus;
    audience: Audience;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const value = draft ?? {
    status: mine?.status ?? "interested",
    audience: mine?.audience ?? "only_me",
  };
  const unchanged =
    !!mine && mine.status === value.status && mine.audience === value.audience;
  async function save(remove = false) {
    setBusy(true);
    setError("");
    try {
      await run({
        action: "plan",
        eventId,
        status: remove ? null : value.status,
        audience: remove ? "only_me" : value.audience,
      });
      setDraft(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your plan could not be saved. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="event-plan-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={busy} className="plan-status-options">
        <legend>Your interest</legend>
        {(["interested", "attending"] as const).map((status) => (
          <label
            key={status}
            className={value.status === status ? "selected" : ""}
          >
            <input
              type="radio"
              name={"plan-" + eventId}
              value={status}
              checked={value.status === status}
              onChange={() => setDraft({ ...value, status })}
            />
            {status === "interested" ? "Interested" : "Planning to attend"}
          </label>
        ))}
      </fieldset>
      <AudienceField
        value={value.audience}
        onChange={(audience) => setDraft({ ...value, audience })}
        disabled={busy}
      />
      <p className="metadata">
        <Lock size={13} />{" "}
        {value.audience === "only_me"
          ? "Only you can see this plan."
          : "Saving publishes your plan to " +
            audiences[value.audience].toLowerCase() +
            "."}{" "}
        A plan is not registration or proof of attendance.
      </p>
      <div className="form-actions">
        <button className="btn primary" disabled={busy || unchanged}>
          {busy
            ? "Saving…"
            : unchanged
              ? "Plan saved"
              : value.audience === "only_me"
                ? "Save private plan"
                : "Save and share plan"}
        </button>
        {mine && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void save(true)}
          >
            Remove plan
          </button>
        )}
      </div>
      {mine && (
        <p className="answer-saved" role="status">
          <Check size={14} />
          {mine.status === "attending"
            ? "Planning to attend"
            : "Interested"} · {audiences[mine.audience]}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
