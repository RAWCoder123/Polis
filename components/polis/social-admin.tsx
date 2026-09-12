"use client";
import { useState } from "react";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import { issues } from "@/lib/social/catalog";
import type { Snapshot, Question } from "@/lib/social/types";
import type { Run, Navigate } from "./social-post";
import { Quiet } from "./social-views";
export function Notifications({
  data,
  run,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
}) {
  const p = data.preferences;
  const groups = new Map<string, Snapshot["notifications"]>();
  for (const n of data.notifications) {
    const key = n.kind === "reaction" ? "reaction:" + n.targetId : n.id;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return (
    <>
      <div className="section-heading">
        <p className="metadata">
          Replies and meaningful updates, all in one place.
        </p>
        <button
          className="text-button"
          onClick={() => {
            void run({ action: "notifications.read" }).catch(() => {});
          }}
        >
          Mark all read
        </button>
      </div>
      {[...groups.values()].map((group) => {
        const n = group[0];
        return (
          <button
            key={n.id}
            className={
              "notification-row " +
              (group.some((v) => !v.readAt) ? "unread" : "")
            }
            onClick={() => {
              void run({
                action: "notifications.read",
                notificationId: n.kind === "reaction" ? undefined : n.id,
                postId: n.kind === "reaction" ? n.targetId : undefined,
              }).catch(() => {});
              navigate(
                n.kind === "friend"
                  ? "friends"
                  : n.kind === "issue"
                    ? "issue/" + n.targetId
                    : n.kind === "event"
                      ? "item/" + n.targetId
                      : "post/" +
                        n.targetId +
                        (n.commentId ? "/" + n.commentId : ""),
              );
            }}
          >
            <span className="notification-dot" />
            <span>
              <strong>
                {n.kind === "reply"
                  ? n.name + " replied to your conversation"
                  : n.kind === "reaction"
                    ? n.name +
                      (group.length > 1
                        ? " and " + (group.length - 1) + " others"
                        : "") +
                      " reacted to your post"
                    : n.kind === "friend"
                      ? n.name + " accepted your friend request"
                      : n.kind === "event"
                        ? "An event in your plans is coming up"
                        : "An issue you follow has an update"}
              </strong>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        );
      })}
      {!data.notifications.length && (
        <Quiet title="You’re all caught up.">
          Replies, accepted requests, and followed-issue updates will appear
          here.
        </Quiet>
      )}
      <details className="notification-preferences">
        <summary>Notification preferences</summary>
        {(["replies", "reactions", "issues", "events"] as const).map((k) => (
          <label className="check-line" key={k}>
            <input
              type="checkbox"
              checked={!!p[k]}
              onChange={(e) => {
                void run({
                  action: "preferences",
                  replies: !!p.replies,
                  reactions: !!p.reactions,
                  issues: !!p.issues,
                  events: !!p.events,
                  [k]: e.target.checked,
                }).catch(() => {});
              }}
            />
            {
              {
                replies: "Replies and accepted friendships",
                reactions: "Reactions to your posts",
                issues: "Important followed-issue updates",
                events: "In-app event reminders (within 24 hours)",
              }[k]
            }
          </label>
        ))}
        <p className="metadata">
          In-app only. Event reminders appear on your next visit. Sample events
          are labeled in their details.
        </p>
      </details>
    </>
  );
}
const newQuestion = (): Question => ({
  id: "",
  issueId: "housing",
  title: "",
  background: "",
  sourceUrl: "https://www.cityofithaca.org/",
  sample: 1,
  optionsJson: JSON.stringify(["Support", "Mixed", "Oppose", "Still learning"]),
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 86400000).toISOString(),
  status: "draft",
});
export function Admin({ data, run }: { data: Snapshot; run: Run }) {
  const [checkedAt] = useState(() => Date.now());
  const [email, setEmail] = useState(""),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false),
    [q, setQ] = useState<Question>(newQuestion),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [update, setUpdate] = useState({
      issueId: "housing",
      title: "",
      sourceUrl: "https://www.cityofithaca.org/",
      sample: true,
    });
  if (!data.admin)
    return (
      <Quiet title="Community owner access required.">
        Return to Home to join the conversation.
      </Quiet>
    );
  return (
    <div className="admin-view">
      <p className="catalog-notice">
        Community owner tools · Invitation links are email-bound and expire
        after seven days. Invitees also need access to this private site.
      </p>
      <section>
        <h2>Invite someone into the community</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await run({ action: "invite", email });
              if (r.invite) {
                setInvite(
                  location.origin + "/?invite=" + encodeURIComponent(r.invite),
                );
                setCopied(false);
              }
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="social-field">
            Their ChatGPT email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Create invitation link
          </button>
        </form>
        {invite && (
          <div className="invite-result">
            <label className="social-field">
              Invitation link
              <input
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invite);
                  setCopied(true);
                } catch {
                  setError("Select the invitation link and copy it.");
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
              {copied ? "Copied" : "Copy invitation"}
            </button>
            <p className="metadata">
              Nothing has been sent. Share the link with this person after
              granting private site access.
            </p>
          </div>
        )}
        <details>
          <summary>
            Created invitations ({data.admin.invitations.length})
          </summary>
          {data.admin.invitations.map((i) => (
            <p key={i.id}>
              {i.email} ·{" "}
              {i.usedBy
                ? "Accepted"
                : Date.parse(i.expiresAt) < checkedAt
                  ? "Expired"
                  : "Pending"}
            </p>
          ))}
        </details>
      </section>
      <section>
        <h2>Daily questions</h2>
        <div className="question-choices">
          <button
            className="btn secondary small-btn"
            onClick={() => setQ(newQuestion())}
          >
            New question
          </button>
          {data.admin.questions.map((question) => (
            <button
              className="text-button"
              key={question.id}
              onClick={() => setQ(question)}
            >
              {question.title} · {question.status}
            </button>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await run({
                action: "question.save",
                questionId: q.id || undefined,
                issueId: q.issueId,
                title: q.title,
                background: q.background,
                sourceUrl: q.sourceUrl,
                sample: !!q.sample,
                options: JSON.parse(q.optionsJson),
                startsAt: q.startsAt,
                endsAt: q.endsAt,
                status: q.status as "draft" | "scheduled" | "withdrawn",
              });
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="social-field">
            Related issue
            <select
              value={q.issueId}
              onChange={(e) => setQ({ ...q, issueId: e.target.value })}
            >
              {issues.map((i) => (
                <option value={i.id} key={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="social-field">
            Question
            <input
              required
              minLength={5}
              maxLength={180}
              value={q.title}
              onChange={(e) => setQ({ ...q, title: e.target.value })}
            />
          </label>
          <label className="social-field">
            Background
            <textarea
              required
              minLength={10}
              maxLength={3000}
              rows={4}
              value={q.background}
              onChange={(e) => setQ({ ...q, background: e.target.value })}
            />
          </label>
          <label className="social-field">
            Source link
            <input
              type="url"
              required
              value={q.sourceUrl}
              onChange={(e) => setQ({ ...q, sourceUrl: e.target.value })}
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={!!q.sample}
              onChange={(e) => setQ({ ...q, sample: +e.target.checked })}
            />
            Clearly label as illustrative sample content
          </label>
          <label className="social-field">
            Response options (one per line)
            <textarea
              rows={4}
              value={JSON.parse(q.optionsJson).join("\n")}
              onChange={(e) =>
                setQ({
                  ...q,
                  optionsJson: JSON.stringify(e.target.value.split("\n")),
                })
              }
            />
          </label>
          <div className="form-columns">
            <label className="social-field">
              Starts (UTC)
              <input
                type="datetime-local"
                required
                value={q.startsAt.slice(0, 16)}
                onChange={(e) => {
                  if (e.target.value)
                    setQ({
                      ...q,
                      startsAt: new Date(e.target.value + "Z").toISOString(),
                    });
                }}
              />
            </label>
            <label className="social-field">
              Ends (UTC)
              <input
                type="datetime-local"
                required
                value={q.endsAt.slice(0, 16)}
                onChange={(e) => {
                  if (e.target.value)
                    setQ({
                      ...q,
                      endsAt: new Date(e.target.value + "Z").toISOString(),
                    });
                }}
              />
            </label>
          </div>
          <label className="social-field">
            Publication status
            <select
              value={q.status}
              onChange={(e) => setQ({ ...q, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="scheduled">
                Scheduled / published during date range
              </option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </label>
          <button className="btn primary" disabled={busy}>
            Save question
          </button>
        </form>
      </section>
      <section>
        <h2>Publish an issue update</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await run({ action: "issue.update", ...update });
              setUpdate({ ...update, title: "" });
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please retry.");
            }
          }}
        >
          <label className="social-field">
            Issue
            <select
              value={update.issueId}
              onChange={(e) =>
                setUpdate({ ...update, issueId: e.target.value })
              }
            >
              {issues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="social-field">
            Significant update
            <input
              required
              minLength={5}
              maxLength={300}
              value={update.title}
              onChange={(e) => setUpdate({ ...update, title: e.target.value })}
            />
          </label>
          <label className="social-field">
            Source URL
            <input
              type="url"
              required
              value={update.sourceUrl}
              onChange={(e) =>
                setUpdate({ ...update, sourceUrl: e.target.value })
              }
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={update.sample}
              onChange={(e) =>
                setUpdate({ ...update, sample: e.target.checked })
              }
            />
            Illustrative update
          </label>
          <button className="btn primary">
            Publish and notify opted-in followers
          </button>
        </form>
      </section>
      <section>
        <h2>Reports</h2>
        {data.admin.reports.length ? (
          data.admin.reports.map((r) => (
            <article className="report-card" key={r.id}>
              <strong>{r.reason}</strong>
              <span>{r.status}</span>
              <details>
                <summary>Reported content</summary>
                <p>{JSON.parse(r.evidence).text ?? "Content unavailable."}</p>
              </details>
              {r.status === "open" && (
                <div className="form-actions">
                  <button
                    className="btn secondary small-btn"
                    onClick={() => {
                      void run({
                        action: "report.resolve",
                        reportId: r.id,
                        removeContent: false,
                      }).catch(() => {});
                    }}
                  >
                    Resolve, keep content
                  </button>
                  <button
                    className="btn secondary small-btn"
                    onClick={() => {
                      void run({
                        action: "report.resolve",
                        reportId: r.id,
                        removeContent: true,
                      }).catch(() => {});
                    }}
                  >
                    Remove content and resolve
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="metadata">No reports to review.</p>
        )}
      </section>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
