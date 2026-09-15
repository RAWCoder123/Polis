"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Lock,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { issues } from "@/lib/social/catalog";
import { audiences, type Audience, type Snapshot } from "@/lib/social/types";
import type { CommandData } from "@/lib/social/service";
import { AudienceField, Modal } from "./social-forms";
import type { Navigate, Run } from "./social-post";

export function IssuePriorities({
  data,
  run,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
}) {
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [sharing, setSharing] = useState(false),
    [selection, setSelection] = useState<string[]>([]),
    [audience, setAudience] = useState<Audience>("friends"),
    [includeNotes, setIncludeNotes] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rows = data.priorities;
  async function submit(command: CommandData) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      return await run(command);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function move(id: string, delta: number) {
    const order = rows.map((r) => r.issueId),
      at = order.indexOf(id);
    [order[at], order[at + delta]] = [order[at + delta], order[at]];
    await submit({ action: "priority.order", issueIds: order });
  }
  const available = issues.filter((i) => !rows.some((r) => r.issueId === i.id));
  return (
    <section className="issue-priorities">
      <div className="priority-intro">
        <span className="social-section-label">YOUR ISSUE PRIORITIES</span>
        <h2>What matters most to you?</h2>
        <p>
          Put the issues that matter most in your community first. There’s no
          right order.
        </p>
        <p className="metadata">
          <Lock size={14} /> Your list and explanations stay private until you
          choose to share them.
        </p>
      </div>
      <div className="form-actions">
        <button
          className="btn primary"
          disabled={!available.length}
          onClick={() => setAdding(!adding)}
        >
          <Plus size={16} /> Add an issue
        </button>
        <button
          className="btn secondary"
          disabled={!rows.length}
          onClick={() => {
            setSelection(rows.map((r) => r.issueId));
            setAudience("friends");
            setIncludeNotes(false);
            setSharing(true);
            setError("");
          }}
        >
          Share a selection <ArrowUpRight size={16} />
        </button>
      </div>
      {adding && (
        <div className="priority-choices" aria-label="Available sample issues">
          <p className="metadata">Sample issue catalog · Ithaca & Cornell</p>
          {available.map((i) => (
            <button
              key={i.id}
              className="post-subject"
              disabled={busy}
              onClick={async () => {
                if (await submit({ action: "priority.save", issueId: i.id }))
                  setAdding(false);
              }}
            >
              <span>
                <strong>{i.name}</strong>
                {i.description}
              </span>
              <Plus size={17} />
            </button>
          ))}
        </div>
      )}
      {!rows.length && (
        <div className="social-empty">
          <h3>Your priorities can start small.</h3>
          <p>
            Choose one issue you care about. You can change your order anytime.
          </p>
        </div>
      )}
      <ol className="priority-list">
        {rows.map((r, i) => (
          <li key={r.issueId}>
            <span className="rank-position">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="priority-content">
              <button
                className="plain-name"
                onClick={() => navigate("issue/" + r.issueId)}
              >
                {issues.find((x) => x.id === r.issueId)?.name}
              </button>
              {r.note && <p>{r.note}</p>}
              {editing === r.issueId && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await submit({
                        action: "priority.save",
                        issueId: r.issueId,
                        note,
                      })
                    )
                      setEditing(null);
                  }}
                >
                  <label className="social-field">
                    Why this matters to you · private
                    <textarea
                      autoFocus
                      maxLength={1000}
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button className="btn primary" disabled={busy}>
                      Save explanation
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="rank-controls">
              <button
                className="icon-btn"
                disabled={busy || i === 0}
                aria-label={
                  "Move " + issues.find((x) => x.id === r.issueId)?.name + " up"
                }
                onClick={() => void move(r.issueId, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-btn"
                disabled={busy || i === rows.length - 1}
                aria-label={
                  "Move " +
                  issues.find((x) => x.id === r.issueId)?.name +
                  " down"
                }
                onClick={() => void move(r.issueId, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-btn"
                aria-label={
                  "Explain " + issues.find((x) => x.id === r.issueId)?.name
                }
                onClick={() => {
                  setNote(r.note);
                  setEditing(r.issueId);
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                disabled={busy}
                aria-label={
                  "Remove " + issues.find((x) => x.id === r.issueId)?.name
                }
                onClick={() =>
                  void submit({ action: "priority.remove", issueId: r.issueId })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {error && !sharing && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {sharing && (
        <Modal
          title="Share your issue priorities"
          description="Publish a snapshot of selected issues in your current order. Later private changes won’t change this post."
          onClose={() => setSharing(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await submit({
                action: "priority.share",
                issueIds: selection,
                title: "My community priorities",
                text,
                audience,
                includeNotes,
              });
              if (result) {
                setSharing(false);
                setText("");
                navigate("post/" + result.postId);
              }
            }}
          >
            {rows.map((r) => (
              <label className="check-line" key={r.issueId}>
                <input
                  type="checkbox"
                  checked={selection.includes(r.issueId)}
                  onChange={(e) =>
                    setSelection(
                      e.target.checked
                        ? [...selection, r.issueId]
                        : selection.filter((x) => x !== r.issueId),
                    )
                  }
                />
                {issues.find((x) => x.id === r.issueId)?.name}
              </label>
            ))}
            <label className="check-line">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
              />
              Include my explanations for these issues
            </label>
            <label className="social-field">
              Add context · optional
              <textarea
                rows={3}
                maxLength={3000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <AudienceField value={audience} onChange={setAudience} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn primary full"
              disabled={busy || !selection.length}
            >
              {busy ? "Publishing…" : "Publish to " + audiences[audience]}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function WelcomeSteps({
  data,
  run,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
}) {
  const [busy, setBusy] = useState(false);
  if (data.me?.onboardingComplete) return null;
  const finish = async () => {
    setBusy(true);
    try {
      await run({ action: "onboarding.complete" });
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="welcome-steps">
      <div>
        <span className="social-section-label">WELCOME TO POLIS</span>
        <h2>A few ways to make this yours.</h2>
        <p>
          Your invitation connects you to Ithaca & Cornell. These steps are
          optional.
        </p>
      </div>
      <div className="form-actions">
        <button className="btn secondary" onClick={() => navigate("profile")}>
          Add a short bio
        </button>
        <button className="btn secondary" onClick={() => navigate("rankings")}>
          Choose your priorities
        </button>
        <button className="btn secondary" onClick={() => navigate("friends")}>
          Find people
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void finish()}
        >
          Finish setup / skip for now
        </button>
      </div>
    </section>
  );
}
