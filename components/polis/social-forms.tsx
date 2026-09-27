"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Lock, Send, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { items, itemById } from "@/lib/polis-data";
import { subjectTitle } from "@/lib/social/catalog";
import { entitiesFor, subjectTakesPosition } from "@/lib/social/civic";
import {
  audiences,
  positions,
  type Audience,
  type CivicEntity,
  type Position,
  type Post,
  type Snapshot,
} from "@/lib/social/types";
import type { CommandData } from "@/lib/social/service";
import { PendingSubmissions } from "@/lib/social/pending-submissions";
import type { Run, Navigate } from "./social-post";
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="polis-dialog social-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function AudienceField({
  value,
  onChange,
  disabled = false,
  communityLabel = "Community",
}: {
  value: Audience;
  onChange: (v: Audience) => void;
  disabled?: boolean;
  communityLabel?: string;
}) {
  return (
    <label className="social-field">
      Who can see this?
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Audience)}
        disabled={disabled}
      >
        {Object.entries(audiences).map(([v, label]) => (
          <option key={v} value={v}>
            {v === "community" ? communityLabel : label}
          </option>
        ))}
      </select>
    </label>
  );
}
function useSubmit(run: Run, draft?: { userId: string; key: string }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pending] = useState(() => new PendingSubmissions(() => window.sessionStorage));
  return {
    error,
    busy,
    submit: async (data: CommandData) => {
      setBusy(true);
      setError("");
      try {
        const submission = draft ? await pending.start(draft.userId, data) : null;
        const result = await run(data, submission?.id);
        if (draft && submission) {
          // Clear the draft before its token, after the caller's refresh has
          // finished. A reload while awaiting that refresh can safely retry.
          try {
            sessionStorage.removeItem(draft.key);
          } catch { /* Storage may be unavailable; the in-memory draft is cleared by the form. */ }
          pending.acknowledge(submission);
        }
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Please try again.");
        return null;
      } finally {
        setBusy(false);
      }
    },
  };
}
export function Onboarding({ name, run }: { name: string; run: Run }) {
  const [displayName, setName] = useState(name === "Seedy" ? "" : name),
    [username, setUsername] = useState(""),
    [invite, setInvite] = useState(() =>
      typeof window === "undefined"
        ? ""
        : (new URLSearchParams(location.search).get("invite") ?? ""),
    );
  const { submit, error, busy } = useSubmit(run);
  return (
    <section className="onboarding-panel">
      <h2>Make yourself at home.</h2>
      <p>Create your Polis profile to join the invited Ithaca community.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit({
            action: "join",
            name: displayName,
            username,
            invite,
          });
          if (r)
            history.replaceState(null, "", location.pathname + location.hash);
        }}
      >
        <label className="social-field">
          Your name
          <input
            required
            maxLength={50}
            value={displayName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="social-field">
          Username
          <input
            required
            pattern="[a-z0-9_]{3,24}"
            title="3–24 lowercase letters, numbers, or underscores"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
          />
        </label>
        <label className="social-field">
          Invitation code
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="POLIS-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <p className="metadata">
          Enter a shared code from your community owner, or use your email-specific
          invitation. The configured community owner can leave this blank.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="btn primary full" disabled={busy}>
          Create profile <ArrowRight size={16} />
        </button>
      </form>
    </section>
  );
}
export type ComposeOptions = {
  coverage?: "local" | "national";
  // Preselected audience, e.g. The Commons when started from the Commons.
  audience?: Audience;
  communityId?: string;
  communityName?: string;
  organizationId?: string;
  organizationChannel?: "announcements" | "discussion" | "plans";
  communityOnly?: boolean;
  subjectLabel?: string;
  subjectId?: string;
  post?: Post;
  prior?: Post;
  copy?: Post;
  kind?:
    "opinion" | "question" | "debate" | "update" | "article" | "event_reflection" | "event_share";
};
const subjectGroups: { label: string; kinds: CivicEntity["kind"][] }[] = [
  { label: "Local topics & issues", kinds: ["issue"] },
  { label: "Starter questions", kinds: ["question"] },
  { label: "Proposals & projects", kinds: ["policy", "project"] },
  { label: "People & offices", kinds: ["official"] },
  { label: "Places & buildings", kinds: ["place", "building", "institution", "elections"] },
  { label: "Organizations & meetings", kinds: ["organization", "meeting"] },
  { label: "Briefs", kinds: ["news"] },
];
export function Composer({
  options,
  onClose,
  run,
  navigate,
  userId,
  onRanking,
}: {
  onRanking: () => void;
  options: ComposeOptions;
  onClose: () => void;
  run: Run;
  navigate: Navigate;
  userId: string;
}) {
  const post = options.post,
    prior = options.prior,
    copy = options.copy;
  const key = "polis-draft:" + userId + ":" + (options.communityId ?? "ithaca") + ":" + (options.organizationId ?? "commons") + ":" + (options.organizationChannel ?? "") + ":" + (post?.id ?? "new");
  const [draft] = useState<{
    kind?:
      "opinion" | "question" | "debate" | "update" | "article" | "event_reflection" | "event_share";
    subject?: string;
    title?: string;
    body?: string;
    sourceUrl?: string;
    pos?: Position | "";
    aud?: Audience;
    priorPostId?: string | null;
  }>(() => {
    if (post || prior || copy || options.subjectId || options.kind) return {};
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });
  const priorPostId = prior?.id ?? draft.priorPostId ?? null;
  const [kind, setKind] = useState<
      "opinion" | "question" | "debate" | "update" | "article" | "event_reflection" | "event_share"
    >(
      ((post?.kind ?? copy?.kind) as "opinion") ??
        options.kind ??
        draft.kind ??
        "opinion",
    ),
    [subject, setSubject] = useState(
      post?.subjectId ??
        prior?.subjectId ??
        copy?.subjectId ??
        options.subjectId ??
        draft.subject ??
        "community",
    ),
    [title, setTitle] = useState(post?.title ?? copy?.title ?? draft.title ?? ""),
    [body, setBody] = useState(post?.text ?? copy?.text ?? draft.body ?? ""),
    [sourceUrl, setSourceUrl] = useState<string>(
      JSON.parse(post?.attachmentJson ?? copy?.attachmentJson ?? "{}")
        .sourceUrl ??
        draft.sourceUrl ??
        "",
    ),
    [pos, setPos] = useState<Position | "">(
      post?.position ?? copy?.position ?? draft.pos ?? "",
    ),
    [aud, setAud] = useState<Audience>(
      post?.audience ?? prior?.audience ?? options.audience ?? draft.aud ?? "friends",
    );
  const { error, busy, submit } = useSubmit(run, post ? undefined : { userId, key });
  useEffect(() => {
    if (post) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ title, body, subject, kind, aud, pos, sourceUrl, priorPostId }),
      );
    } catch {}
  }, [key, title, body, subject, kind, aud, pos, sourceUrl, post, priorPostId]);
  const canPosition =
    (kind === "opinion" || kind === "debate") &&
    subjectTakesPosition(options.communityId ?? "ithaca", subject);
  const catalog = entitiesFor(options.communityId ?? "ithaca");
  const choices = options.communityOnly ? [] : items.filter((i) =>
    kind === "article"
      ? i.kind === "News"
      : kind === "event_reflection" || kind === "event_share"
        ? i.kind === "Events"
        : true,
  );
  function changeKind(value: typeof kind) {
    setKind(value);
    setPos("");
    if (value === "article") setSubject(options.communityOnly ? "community" : "housing");
    if (value === "event_reflection" || value === "event_share")
      setSubject("housing-meeting");
  }
  return (
    <Modal
      title={
        post
          ? "Edit your post"
          : priorPostId
            ? "What changed your mind?"
            : aud === "community" && !options.organizationId
              ? "Start a discussion in The Commons"
              : "Add your perspective"
      }
      description={
        copy
          ? "This starts a new conversation. Existing replies stay with the original post."
          : post
            ? "The audience stays the same, including for existing replies."
            : "Tie it to something real — a topic, place, office or proposal — so others can find it."
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(
            post
              ? {
                  action: "post.edit",
                  title,
                  postId: post.id,
                  text: body,
                  sourceUrl,
                  position: canPosition && pos ? pos : null,
                }
              : {
                  action: "post",
                  title,
                  coverage: options.coverage ?? "local",
                  organizationId: options.organizationId,
                  organizationChannel: options.organizationChannel,
                  kind,
                  subjectId: subject,
                  text: body,
                  sourceUrl,
                  position: canPosition && pos ? pos : null,
                  audience: aud,
                  priorPostId,
                },
          );
          if (r) {
            try {
              sessionStorage.removeItem(key);
            } catch {}
            onClose();
            if (r.postId) navigate("post/" + r.postId + "?community=" + (options.communityId ?? "ithaca"));
          }
        }}
      >
        {!post && !priorPostId && (
          <label className="social-field">
            What would you like to share?
            <select
              value={kind}
              onChange={(e) => {
                if (e.target.value === "ranking") {
                  onClose();
                  onRanking();
                } else changeKind(e.target.value as typeof kind);
              }}
            >
              <option value="opinion">An opinion</option>
              <option value="question">A question</option>
              <option value="debate">A debate · No side required</option>
              <option value="update">A sourced update</option>
              <option value="article">An article with commentary</option>
              {!options.communityOnly && <>
              <option value="event_share">An event with commentary</option>
              <option value="event_reflection">An event reflection</option>
              <option value="ranking">A selected ranking update</option>
              </>}
            </select>
          </label>
        )}
        <label className="social-field">
          Subject
          <select
            value={subject}
            disabled={!!post || !!priorPostId}
            onChange={(e) => {
              setSubject(e.target.value);
              setPos("");
            }}
          >
            <option value="community">General conversation</option>
            {kind !== "event_reflection" &&
              kind !== "event_share" &&
              subjectGroups.map((g) => {
                const rows = catalog.filter((e) => g.kinds.includes(e.kind));
                return rows.length ? (
                  <optgroup key={g.label} label={g.label}>
                    {rows.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.sample ? " · Sample" : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            {subject !== "community" && !catalog.some((e) => e.id === subject) && !itemById[subject] && (
              <option value={subject}>
                {subject === "community" ? "Community observation" : options.subjectLabel || subjectTitle(subject)}
              </option>
            )}
            {choices.length > 0 && (
              <optgroup label="Fictional sample catalog">
                {choices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title} · Sample {i.kind.toLowerCase()}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <p className="metadata">{post?.coverage === "national" || options.coverage === "national" ? "National discussion" : "Local discussion"} · {options.communityName ?? "Your community"}. The scope and audience stay fixed after publication.</p>
        <label className="social-field">{kind === "question" || kind === "debate" ? "Headline or question" : "Discussion title"} <span>optional</span><input maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === "debate" ? "e.g. Should the late bus run until 2 a.m.?" : "What would you like to talk about?"} /></label>
        {canPosition && (
          <label className="social-field">
            Your position <span>optional</span>
            <select
              value={pos}
              onChange={(e) => setPos(e.target.value as Position | "")}
            >
              <option value="">No position selected</option>
              {Object.entries(positions).map(([v, label]) => (
                <option value={v} key={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="social-field">
          {kind === "question" ? "Your question" : "In your own words"}
          <textarea
            autoFocus
            rows={5}
            maxLength={3000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What matters to you about this?"
          />
        </label>
        <label className="social-field">
          {kind === "update" ? "Source link · required" : kind === "article" ? "Article link" : "Source link · optional"}
          <input
            type="url"
            placeholder="https://…"
            maxLength={2000}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required={kind === "update" || (kind === "article" && itemById[subject]?.kind !== "News")}
          />
        </label>
        <AudienceField
          value={aud}
          onChange={setAud}
          disabled={!!post || !!priorPostId}
          communityLabel={options.organizationId || post?.organizationId ? "Organization members" : options.communityName ?? "Community"}
        />
        <p className="metadata">
          {(options.organizationId || post?.organizationId) && <strong>Private organization conversation. </strong>}
          <Lock size={13} />{" "}
          {aud === "friends"
            ? "Only accepted friends can see and respond."
            : aud === "only_me"
              ? "Only you can see this post."
              : options.organizationId || post?.organizationId ? "Visible only inside this organization." : "Posted in The Commons: visible to members of " + (options.communityName ?? "your current community") + ", not the public web."}{" "}
          <button type="button" className="text-button inline" onClick={() => { onClose(); navigate("guidelines"); }}>
            Guidelines
          </button>
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button
          className="btn primary full"
          disabled={busy || (!body.trim() && !pos && !(title.trim() && (kind === "question" || kind === "debate")))}
        >
          {busy
            ? "Saving…"
            : post
              ? "Save changes"
              : aud === "community" && !options.organizationId
                ? "Post to The Commons"
                : "Publish to " + (aud === "community" && options.organizationId ? "organization members" : audiences[aud])}
          <Send size={16} />
        </button>
      </form>
    </Modal>
  );
}
export function DailyQuestion({
  data,
  run,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
}) {
  const q = data.question;
  const [expanded, setExpanded] = useState(false),
    [editingResponse, setEditingResponse] = useState(false),
    [choice, setChoice] = useState(data.answer?.choice ?? ""),
    [note, setNote] = useState(data.answer?.note ?? ""),
    [aud, setAud] = useState<Audience>(data.answer?.audience ?? "only_me");
  const { error, busy, submit } = useSubmit(run);
  if (!q) return null;
  const options = [
    ...new Set<string>([...JSON.parse(q.optionsJson), "Still learning"]),
  ];
  return (
    <section className="daily-card">
      <div className="social-section-label">
        {q.sample ? "SAMPLE QUESTION" : "TODAY’S LOCAL QUESTION"}
      </div>
      <h2>{q.title}</h2>
      <button
        className="text-button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? "Close background" : "Read the background"}{" "}
        <ArrowUpRight size={14} />
      </button>
      {expanded && (
        <div className="daily-background">
          <p>{q.background}</p>
          <a href={q.sourceUrl} target="_blank" rel="noreferrer">
            {q.sample
              ? "Community reference · does not verify this sample"
              : "Read the source"}{" "}
            <ArrowUpRight size={13} />
          </a>
          <button
            className="text-button"
            onClick={() => navigate("issue/" + q.issueId)}
          >
            Explore the issue <ArrowRight size={14} />
          </button>
        </div>
      )}
      {(!data.answer || editingResponse) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await submit({
              action: "answer",
              questionId: q.id,
              choice,
              note,
              audience: aud,
            });
          }}
        >
          <fieldset className="daily-options">
            <legend className="sr-only">Your response</legend>
            {options.map((o) => (
              <label className={choice === o ? "selected" : ""} key={o}>
                <input
                  type="radio"
                  name="daily-response"
                  value={o}
                  checked={choice === o}
                  onChange={() => setChoice(o)}
                />
                {o}
              </label>
            ))}
          </fieldset>
          {choice && choice !== "skip" && (
            <>
              <label className="social-field">
                Add a thought <span>optional</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1500}
                />
              </label>
              <AudienceField value={aud} onChange={setAud} />
            </>
          )}
          {aud !== "only_me" && (
            <p className="metadata">
              Saving publishes a new conversation. Earlier shared responses
              remain in your profile until you delete their posts.
            </p>
          )}
          <div className="daily-actions">
            <button
              className="btn primary small-btn"
              disabled={busy || !choice || choice === "skip"}
            >
              {aud !== "only_me"
                ? "Save & publish to " + audiences[aud]
                : data.answer
                  ? "Update response"
                  : "Save response"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                void submit({
                  action: "answer",
                  questionId: q.id,
                  choice: "skip",
                  note: "",
                  audience: "only_me",
                });
              }}
            >
              Skip for now
            </button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </form>
      )}
      {data.answer && (
        <>
          <p className="answer-saved">
            <Check size={14} />
            {data.answer.choice === "skip"
              ? "Skipped. You can return to this question."
              : data.answer.choice + " · " + audiences[data.answer.audience]}
          </p>
          <button
            className="text-button"
            onClick={() => setEditingResponse(!editingResponse)}
          >
            {editingResponse ? "Close response" : "Revisit response"}
          </button>
        </>
      )}
      {!!q.counts?.length && (
        <details className="daily-results">
          <summary>
            {q.counts.reduce((n, c) => n + c.count, 0)} shared responses
          </summary>
          {q.counts.map((c) => (
            <p key={c.choice}>
              {c.choice}
              <strong>{c.count}</strong>
            </p>
          ))}
          <small>
            Shared responses visible to you, not representative polling.
          </small>
        </details>
      )}
    </section>
  );
}
export function ReplyComposer({
  userId,
  postId,
  parentId = null,
  editing,
  onCancel,
  run,
  onSaved,
  disabled = false,
  takesPosition = false,
}: {
  userId: string;
  postId: string;
  parentId?: string | null;
  editing?: { id: string; text: string; position?: Position | null };
  onCancel?: () => void;
  run: Run;
  onSaved?: () => void;
  disabled?: boolean;
  takesPosition?: boolean;
}) {
  const key =
    "polis-reply:" +
    userId +
    ":" +
    postId +
    ":" +
    (parentId ?? editing?.id ?? "root");
  const [body, setBody] = useState(() => {
    if (editing) return editing.text;
    try {
      return sessionStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });
  const [stance, setStance] = useState<Position | "">(editing?.position ?? "");
  const { submit, error, busy } = useSubmit(run, editing ? undefined : { userId, key });
  return (
    <form
      className="reply-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const position = takesPosition && stance ? stance : null;
        const r = await submit(
          editing
            ? { action: "comment.edit", commentId: editing.id, text: body, ...(takesPosition ? { position } : {}) }
            : { action: "comment", postId, parentId, text: body, position },
        );
        if (r) {
          setBody("");
          setStance("");
          try {
            sessionStorage.removeItem(key);
          } catch {}
          onSaved?.();
          onCancel?.();
        }
      }}
    >
      <label className="social-field">
        {editing
          ? "Edit reply"
          : parentId
            ? "Reply to this comment"
            : "Join the conversation"}
        <textarea
          rows={3}
          required
          maxLength={3000}
          placeholder="Add a thought or ask a question…"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            try {
              sessionStorage.setItem(key, e.target.value);
            } catch {}
          }}
        />
      </label>
      {takesPosition && (
        <fieldset className="stance-picker">
          <legend>
            Your perspective <span>optional</span>
          </legend>
          {([["", "No label"], ...Object.entries(positions)] as [Position | "", string][]).map(([value, label]) => (
            <label key={value || "none"} className={stance === value ? "chosen" : ""}>
              <input
                type="radio"
                name={"stance-" + key}
                value={value}
                checked={stance === value}
                onChange={() => setStance(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          className="btn primary small-btn"
          disabled={disabled || busy || !body.trim()}
        >
          {editing ? "Save reply" : "Reply"}
          <Send size={14} />
        </button>
        {onCancel && (
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
export function ShareRanking({
  data,
  run,
  onClose,
  navigate,
}: {
  data: Snapshot;
  run: Run;
  onClose: () => void;
  navigate: Navigate;
}) {
  const [selected, setSelected] = useState(
      data.rankings.slice(0, 5).map((r) => r.itemId),
    ),
    [title, setTitle] = useState("My civic ratings"),
    [body, setBody] = useState(""),
    [aud, setAud] = useState<Audience>("friends");
  const { submit, error, busy } = useSubmit(run);
  return (
    <Modal
      title="Share a little of your perspective."
      description="Only the selected items and scores are shared. Your private notes and future changes stay private."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit({
            action: "ranking.share",
            itemIds: data.rankings
              .filter((r) => selected.includes(r.itemId))
              .map((r) => r.itemId),
            title,
            text: body,
            audience: aud,
          });
          if (r?.postId) {
            onClose();
            navigate("list/" + r.postId);
          }
        }}
      >
        <label className="social-field">
          List title
          <input
            value={title}
            maxLength={120}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <fieldset className="share-items">
          <legend>Choose up to 20 items</legend>
          {data.rankings.map((r) => (
            <label key={r.itemId}>
              <input
                type="checkbox"
                checked={selected.includes(r.itemId)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, r.itemId]
                      : s.filter((id) => id !== r.itemId),
                  )
                }
              />
              <span>{subjectTitle(r.itemId)}</span>
              <strong>{r.score.toFixed(1)}</strong>
            </label>
          ))}
        </fieldset>
        <label className="social-field">
          Why these? <span>optional</span>
          <textarea
            rows={3}
            value={body}
            maxLength={3000}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <AudienceField value={aud} onChange={setAud} />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button
          className="btn primary full"
          disabled={busy || !selected.length || selected.length > 20}
        >
          Publish selected list
        </button>
      </form>
    </Modal>
  );
}
export function ActionDialog({
  target,
  run,
  onClose,
  navigate,
}: {
  target: string;
  run: Run;
  onClose: () => void;
  navigate: Navigate;
}) {
  const [reason, setReason] = useState("");
  const { submit, error, busy } = useSubmit(run);
  const deleting = target.startsWith("delete:"),
    block = target.startsWith("block:"),
    comment = target.startsWith("comment-delete:");
  return (
    <Modal
      title={
        deleting || comment
          ? "Delete this contribution?"
          : block
            ? "Block this person?"
            : "Report this contribution"
      }
      description={
        deleting || comment
          ? "It will disappear from conversations and notifications."
          : block
            ? "You will no longer see or interact with each other. Your friendship will be removed."
            : "Your report is private and goes to the community owner for review."
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await submit(
            deleting
              ? { action: "post.delete", postId: target.slice(7) }
              : comment
                ? { action: "comment.delete", commentId: target.slice(15) }
                : block
                  ? {
                      action: "block",
                      targetId: target.slice(6),
                      enabled: true,
                    }
                  : { action: "report", targetId: target, reason },
          );
          if (r) {
            onClose();
            if (deleting || block) navigate("home");
          }
        }}
      >
        {!deleting && !block && !comment && (
          <label className="social-field">
            What should we review?
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary full" disabled={busy}>
          {deleting || comment
            ? "Delete"
            : block
              ? "Block person"
              : "Submit report"}
        </button>
      </form>
    </Modal>
  );
}
