"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  ArrowUpRight,
  ThumbsUp,
  Lightbulb,
  HelpCircle,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "./common";
import {
  audiences,
  positions,
  type Post,
  type Person,
  type CommandResult,
} from "@/lib/social/types";
import { itemById } from "@/lib/polis-data";
import { subjectTitle } from "@/lib/social/catalog";
import type { CommandData } from "@/lib/social/service";
export type Run = (
  data: CommandData,
  requestId?: string,
) => Promise<CommandResult>;
export type Navigate = (route: string) => void;
const reactionChoices = [
  { kind: "agree", label: "Agree", Icon: ThumbsUp },
  { kind: "thoughtful", label: "Thought-provoking", Icon: Lightbulb },
  { kind: "curious", label: "Want to understand more", Icon: HelpCircle },
] as const;

export function PostCard({
  post,
  me,
  run,
  navigate,
  onEdit,
  onReport,
  busy,
  expanded = false,
}: {
  expanded?: boolean;
  post: Post;
  me: Person;
  run: Run;
  navigate: Navigate;
  onEdit: (post: Post) => void;
  onReport: (id: string) => void;
  busy: boolean;
}) {
  const [showCounts, setShowCounts] = useState(false);
  const attachment = JSON.parse(post.attachmentJson || "{}");
  const subjectKind = itemById[post.subjectId]?.kind;
  const subjectLabel =
    post.kind === "event_plan"
      ? "SHARED PLAN"
      : subjectKind === "Events" || attachment.eventId
        ? "RELATED EVENT"
        : subjectKind === "News"
          ? "RELATED ARTICLE"
          : subjectKind === "Policies"
            ? "RELATED PROPOSAL"
            : subjectKind === "Politicians"
              ? "RELATED PERSON"
              : "RELATED ISSUE";
  const react = async (kind: "agree" | "thoughtful" | "curious") => {
    try {
      await run({
        action: "reaction",
        postId: post.id,
        kind: post.myReaction === kind ? null : kind,
      });
    } catch {}
  };
  return (
    <article className="social-post" id={"post-" + post.id}>
      <header>
        <button
          className="avatar-link"
          aria-label={"View " + post.name}
          onClick={() => navigate("profile/" + post.authorId)}
        >
          <Avatar
            initials={post.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          />
        </button>
        <div>
          <button
            className="plain-name"
            onClick={() => navigate("profile/" + post.authorId)}
          >
            {post.name}
          </button>
          <span>
            {new Date(post.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {audiences[post.audience]}
            {post.editedAt ? " · Edited" : ""}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="icon-btn"
            aria-label={"Actions for " + post.name + "’s post"}
          >
            <MoreHorizontal size={20} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {post.authorId === me.id ? (
              <>
                <DropdownMenuItem onClick={() => onEdit(post)}>
                  Edit post
                </DropdownMenuItem>
                {[
                  "opinion",
                  "question",
                  "article",
                  "event_reflection",
                  "event_share",
                ].includes(post.kind) && (
                  <DropdownMenuItem
                    onClick={() =>
                      onEdit({ ...post, priorPostId: "republish" })
                    }
                  >
                    Share as a new post
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onReport("delete:" + post.id)}>
                  Delete post
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    void run({
                      action: "mute",
                      targetId: post.authorId,
                      enabled: true,
                    }).catch(() => {});
                  }}
                >
                  Mute {post.name}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onReport("block:" + post.authorId)}
                >
                  Block {post.name}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReport(post.id)}>
                  Report post
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard
                  .writeText(location.origin + "/#post/" + post.id)
                  .then(() => toast.success("Conversation link copied."))
                  .catch(() =>
                    toast.error(
                      "Could not copy. Use the conversation address.",
                    ),
                  );
              }}
            >
              Copy conversation link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {post.position && (
        <span className="post-position">{positions[post.position]}</span>
      )}
      {post.kind === "ranking" && (
        <span className="post-position">
          {attachment.rankingKind === "issue_priorities"
            ? "Shared issue priorities"
            : "Shared a ranking"}
        </span>
      )}
      {post.kind === "event_share" && (
        <span className="post-position">Shared an event</span>
      )}
      {post.kind === "event_reflection" && (
        <span className="post-position">An event reflection</span>
      )}
      {post.priorPostId && (
        <button
          className="text-button previous-view"
          onClick={() => navigate("post/" + post.priorPostId)}
        >
          An updated view · Read the earlier post <ArrowRight size={14} />
        </button>
      )}
      <p className="post-text">{post.text}</p>
      {attachment.sourceUrl && (
        <a
          className="post-source"
          href={attachment.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Source · {new URL(attachment.sourceUrl).hostname}{" "}
          <ArrowUpRight size={14} />
        </a>
      )}
      {attachment.items && (
        <button
          className="shared-list-preview"
          onClick={() => navigate("list/" + post.id)}
        >
          <strong>{attachment.title}</strong>
          {attachment.items.slice(0, expanded ? 20 : 5).map(
            (
              r: {
                itemId: string;
                title: string;
                score?: number;
                note?: string;
                position?: keyof typeof positions;
              },
              i: number,
            ) => (
              <span key={r.itemId}>
                <b>{i + 1}</b>
                <span>
                  {r.title}
                  {expanded && typeof r.score === "number" && (
                    <small>
                      {itemById[r.itemId]?.kind === "News"
                        ? "Usefulness"
                        : itemById[r.itemId]?.kind === "Events"
                          ? "Experience"
                          : "Support"}{" "}
                      {r.score.toFixed(1)} / 10
                      {r.position ? " · " + positions[r.position] : ""}
                    </small>
                  )}
                  {expanded && r.note && <small>{r.note}</small>}
                </span>
              </span>
            ),
          )}
          <small>
            {expanded
              ? "Shared selection, in the author’s chosen order"
              : "View shared list"}{" "}
            {!expanded && <ArrowUpRight size={13} />}
          </small>
        </button>
      )}
      <button
        className="post-subject"
        onClick={() =>
          navigate(
            (attachment.eventId
              ? "event/"
              : itemById[post.subjectId]
                ? "item/"
                : "issue/") + post.subjectId,
          )
        }
      >
        <span>
          {subjectLabel}
          {post.issueId ? " · " + post.issueId.toUpperCase() : ""}
          <strong>
            {attachment.eventTitle || subjectTitle(post.subjectId)}
          </strong>
        </span>
        <ArrowUpRight size={19} />
      </button>
      <footer>
        {reactionChoices.map(({ kind, label, Icon }) => (
          <button
            key={kind}
            className={"reaction " + (post.myReaction === kind ? "chosen" : "")}
            aria-pressed={post.myReaction === kind}
            disabled={busy}
            onClick={() => void react(kind)}
          >
            <Icon size={16} />
            {label}
            <span>
              {post.reactions.find((r) => r.kind === kind)?.count || ""}
            </span>
          </button>
        ))}
        <button
          className="reaction"
          onClick={() => navigate("post/" + post.id)}
          aria-label={"Open conversation, " + post.replyCount + " replies"}
        >
          <MessageCircle size={17} />
          {post.replyCount || "Reply"}
        </button>
        <button
          className="reaction save-post"
          aria-label={post.saved ? "Unsave post" : "Save post"}
          aria-pressed={post.saved}
          disabled={busy}
          onClick={() => {
            void run({
              action: "save",
              targetId: post.id,
              enabled: !post.saved,
            }).catch(() => {});
          }}
        >
          {post.saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
      </footer>
      <button
        className="count-disclosure"
        onClick={() => setShowCounts(!showCounts)}
        aria-expanded={showCounts}
      >
        Reaction counts
      </button>
      {showCounts && (
        <p className="metadata">
          {reactionChoices
            .map(
              ({ kind, label }) =>
                label +
                ": " +
                (post.reactions.find((r) => r.kind === kind)?.count ?? 0),
            )
            .join(" · ")}{" "}
          · Responses from people who can see this post.
        </p>
      )}
    </article>
  );
}
