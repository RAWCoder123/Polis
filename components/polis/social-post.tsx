"use client";
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
  CalendarDays,
  FileText,
  Users,
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
import { discussionLabels, organizationFor } from "@/lib/social/commons";
import { communityFor } from "@/lib/social/communities";
import { entityFor } from "@/lib/social/civic";
import type { CommandData } from "@/lib/social/service";
import { EntityChip } from "./civic-cards";
export type Run = (
  data: CommandData,
  requestId?: string,
) => Promise<CommandResult>;
export type Navigate = (route: string) => void;
// Stored reaction kinds remain compatible. One per person; switching replaces it.
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
  compact = false,
  unread = false,
}: {
  expanded?: boolean;
  compact?: boolean;
  unread?: boolean;
  post: Post;
  me: Person;
  run: Run;
  navigate: Navigate;
  onEdit: (post: Post) => void;
  onReport: (id: string) => void;
  busy: boolean;
}) {
  const route = "post/" + post.id + "?community=" + post.communityId;
  const attachment = JSON.parse(post.attachmentJson || "{}");
  const entity = entityFor(post.subjectId);
  const topic = entity && entity.kind !== "issue" && post.issueId ? entityFor(post.issueId) : undefined;
  const legacyItem = itemById[post.subjectId];
  const react = async (kind: (typeof reactionChoices)[number]["kind"]) => {
    try {
      await run({
        action: "reaction",
        postId: post.id,
        kind: post.myReaction === kind ? null : kind,
      });
    } catch {}
  };
  return (
    <article
      className={"social-post " + (compact ? "forum-row" : "") + (unread ? " has-unread" : "")}
      id={"post-" + post.id}
      data-position={post.position ?? ""}
    >
      {compact && <h2 className="forum-title"><button onClick={() => navigate(route)}>{post.title || (post.text.length > 140 ? post.text.slice(0, 137) + "…" : post.text) || subjectTitle(post.subjectId)}</button></h2>}
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
            · {post.organizationId && post.audience === "community" ? "Organization members" : post.audience === "community" ? "The Commons" : audiences[post.audience]}
            {" · "}{communityFor(post.communityId)?.name ?? "Community"}
            {post.organizationId && " · " + organizationFor(post.organizationId)?.name + " (private)"}
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
                  "debate",
                  "update",
                  "article",
                  "event_reflection",
                  "event_share",
                ].includes(post.kind) && (
                  <DropdownMenuItem
                    onClick={() =>
                      onEdit({ ...post, priorPostId: "republish" })
                    }
                  >
                    {post.organizationId ? "Publish a new copy to Commons" : "Share as a new post"}
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
                  .writeText(location.origin + "/#" + route)
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
      {/* Untitled posts lead with their text rather than repeating it as a heading. */}
      {!compact && (post.title || !post.text) && (
        <h2 className="forum-title">
          <button onClick={() => navigate(route)}>{post.title || subjectTitle(post.subjectId)}</button>
        </h2>
      )}
      {unread && <button className="thread-unread text-button" onClick={() => navigate(route)}>Unread reply · Return to the conversation</button>}
      {post.position && (
        <span className="post-position">{positions[post.position]}</span>
      )}
      {!compact && discussionLabels[post.kind] && <span className="post-position">{post.organizationId && attachment.organizationChannel === "announcements" ? "Announcement" : discussionLabels[post.kind]}</span>}
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
      {(!compact || !!post.title) && <p className="post-text">{post.text}</p>}
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
      {post.subjectId !== "community" && (
        <div className="post-about">
          <span>About</span>
          {entity ? (
            <>
              <EntityChip entity={entity} navigate={navigate} />
              {topic && <EntityChip entity={topic} navigate={navigate} />}
            </>
          ) : attachment.eventId ? (
            <button className="entity-chip tone-event" onClick={() => navigate("event/" + attachment.eventId)}>
              <CalendarDays size={13} aria-hidden="true" />
              <span>{attachment.eventTitle}</span>
            </button>
          ) : (
            <button
              className="entity-chip tone-paper"
              onClick={() => navigate((legacyItem ? "item/" : "issue/") + post.subjectId)}
            >
              <FileText size={13} aria-hidden="true" />
              <span>
                {subjectTitle(post.subjectId)}
                {legacyItem ? " · Sample" : ""}
              </span>
            </button>
          )}
        </div>
      )}
      <footer>
        <span className="reaction-set" role="group" aria-label="Reactions from people who can see this post">
          {reactionChoices.map(({ kind, label, Icon }) => {
            const count = post.reactions.find((r) => r.kind === kind)?.count ?? 0;
            return (
              <button
                key={kind}
                className={"reaction " + (post.myReaction === kind ? "chosen" : "")}
                aria-pressed={post.myReaction === kind}
                aria-label={label + (count ? " " + count : "")}
                title={label}
                disabled={busy}
                onClick={() => void react(kind)}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="reaction-label">{label}</span>
                {count > 0 && <span className="reaction-count">{count}</span>}
              </button>
            );
          })}
        </span>
        <button
          className="reaction"
          onClick={() => navigate(route + "&reply=1")}
          aria-label={"Open conversation, " + post.replyCount + (post.replyCount === 1 ? " reply" : " replies")}
        >
          <MessageCircle size={16} />
          {post.replyCount ? post.replyCount + (post.replyCount === 1 ? " reply" : " replies") : "Reply"}
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
      <div className="commons-thread-meta"><button className="text-button" aria-pressed={!!post.following} disabled={busy} onClick={() => void run({ action: "conversation.follow", postId: post.id, enabled: !post.following }).catch(() => {})}>{post.following ? "Following thread · Undo" : "Follow thread"}</button><span><Users size={13} aria-hidden="true" /> {post.participantCount} {post.participantCount === 1 ? "person" : "people"} · Latest activity {new Date(post.latestActivity ?? post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
    </article>
  );
}
