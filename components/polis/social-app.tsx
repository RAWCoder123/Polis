"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Asterisk,
  House,
  Compass,
  ChartNoAxesColumnIncreasing,
  Users,
  UserRound,
  Bell,
  Plus,
  ArrowUpRight,
  MapPin,
  ArrowRight,
  Search,
  X,
  Settings,
  LogOut,
  Lock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { items, itemById, type CivicItem } from "@/lib/polis-data";
import type { Post } from "@/lib/social/types";
import type { DemoState } from "@/lib/polis-state";
import { useSocial } from "@/lib/social/use-social";
import { issues, subjectTitle } from "@/lib/social/catalog";
import { Avatar } from "./common";
import CommunityMap from "./community-map";
import { RankDialog } from "./dialogs";
import { PostCard } from "./social-post";
import {
  ActionDialog,
  Composer,
  DailyQuestion,
  Onboarding,
  ShareRanking,
  type ComposeOptions,
} from "./social-forms";
import {
  Conversation,
  EditProfile,
  Explore,
  Friends,
  IssueDetail,
  ItemDetail,
  Profile,
  Quiet,
  RankingList,
} from "./social-views";
import { Admin, Notifications } from "./social-admin";
function subscribeLocation(change: () => void) {
  window.addEventListener("hashchange", change);
  window.addEventListener("popstate", change);
  return () => {
    window.removeEventListener("hashchange", change);
    window.removeEventListener("popstate", change);
  };
}
export default function SocialApp() {
  const browserLocation = useSyncExternalStore(
    subscribeLocation,
    () => location.href,
    () => "/",
  );
  const currentLocation = new URL(browserLocation, "https://polis.invalid");
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(
    currentLocation.hostname,
  );
  const signin =
    "/signin-with-chatgpt?return_to=" +
    encodeURIComponent(
      currentLocation.pathname + currentLocation.search + currentLocation.hash,
    );
  const route = currentLocation.hash.slice(1) || "home";
  const [filter, setFilter] = useState("friends"),
    [query, setQuery] = useState(""),
    [composer, setComposer] = useState<ComposeOptions | null>(null),
    [rankItem, setRankItem] = useState<CivicItem | undefined>(),
    [rankOpen, setRankOpen] = useState(false),
    [share, setShare] = useState(false),
    [actionTarget, setActionTarget] = useState(""),
    [editing, setEditing] = useState(false);
  const [view, id, commentId] = route.split("/");
  const params = new URLSearchParams();
  params.set("filter", view === "home" ? filter : "all");
  if (view === "post" || view === "list") params.set("post", id ?? "");
  if (commentId) params.set("comment", commentId);
  if (view === "issue") params.set("issue", id ?? "");
  if (view === "profile") params.set("author", id ?? "me");
  if (view === "saved") params.set("filter", "saved");
  if (query && view === "home") params.set("q", query);
  const { data, loading, error, busy, run, refresh, loadMore, loadComments } =
    useSocial(params.toString());
  const me = data.me;
  useEffect(() => {
    if (!commentId || loading) return;
    document
      .getElementById("comment-" + commentId)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [commentId, loading]);
  const visitorId = me?.id;
  const visited = useRef("");
  const visitPending = useRef(false);
  useEffect(() => {
    if (data.status !== "ready" || !visitorId) return;
    const userId = visitorId;
    const visit = async () => {
      const day = userId + ":" + new Date().toISOString().slice(0, 10);
      if (
        document.visibilityState !== "visible" ||
        visited.current === day ||
        visitPending.current
      )
        return;
      visitPending.current = true;
      try {
        const response = await fetch("/api/polis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            data: { action: "visit" },
          }),
        });
        if (!response.ok) throw new Error("Activity was not recorded.");
        visited.current = day;
      } catch {
        /* Retry on the next visible activity. */
      } finally {
        visitPending.current = false;
      }
    };
    void visit();
    window.addEventListener("focus", visit);
    document.addEventListener("visibilitychange", visit);
    document.addEventListener("pointerdown", visit);
    document.addEventListener("keydown", visit);
    return () => {
      window.removeEventListener("focus", visit);
      document.removeEventListener("visibilitychange", visit);
      document.removeEventListener("pointerdown", visit);
      document.removeEventListener("keydown", visit);
    };
  }, [data.status, visitorId]);
  function navigate(next: string) {
    if (location.hash === "#" + next) {
      return;
    }
    location.hash = next;
    setQuery("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function compose(o: ComposeOptions = {}) {
    if (data.status !== "ready") {
      location.href = signin;
      return;
    }
    setComposer(o);
  }
  function editPost(p: Post) {
    if (p.priorPostId === "publish-change")
      setComposer({ prior: { ...p, priorPostId: null } });
    else if (p.priorPostId === "republish")
      setComposer({ copy: { ...p, priorPostId: null } });
    else setComposer({ post: p });
  }
  function rank(item?: CivicItem) {
    setRankItem(item);
    setRankOpen(true);
  }
  const nav = [
    { id: "home", label: "Home", Icon: House },
    { id: "explore", label: "Explore", Icon: Compass },
    { id: "rankings", label: "Rankings", Icon: ChartNoAxesColumnIncreasing },
    { id: "friends", label: "Friends", Icon: Users },
    { id: "profile", label: "Profile", Icon: UserRound },
  ];
  const title =
    view === "home"
      ? "A little more connected."
      : view === "explore"
        ? "Your community, a little closer."
        : view === "rankings"
          ? "Your perspective, in order."
          : view === "friends"
            ? "Different views. Familiar faces."
            : view === "notifications"
              ? "Something worth coming back to."
              : view === "admin"
                ? "Care for your community."
                : view === "saved"
                  ? "Saved for a little later."
                  : "";
  const rankState: DemoState = {
    rankings: data.rankings.map((r) => ({
      itemId: r.itemId,
      score: r.score,
      note: r.note,
      audience: "Private",
    })),
    saved: [],
    plans: [],
    following: [],
    read: [],
    explored: false,
    showFriendRsvps: false,
    profileName: me?.name ?? "",
    bio: me?.bio ?? "",
  };
  const posts = data.posts.map((post) => (
    <PostCard
      key={post.id}
      post={post}
      me={me!}
      run={run}
      navigate={navigate}
      onEdit={editPost}
      onReport={setActionTarget}
      busy={busy}
    />
  ));
  const feed = (
    <>
      {posts}
      {loading && !posts.length ? (
        <div className="social-loading" role="status">
          Loading your conversations…
        </div>
      ) : !posts.length && !error ? (
        <Quiet
          title={
            view === "home" && filter === "friends"
              ? "A conversation starts with someone."
              : "A little room for a new perspective."
          }
        >
          {view === "home" && filter === "friends" ? (
            <>
              Add a friend or share your first take.{" "}
              <button
                className="text-button"
                onClick={() => navigate("friends")}
              >
                Find people <ArrowRight size={14} />
              </button>
            </>
          ) : (
            "There are no contributions visible in this view yet."
          )}
        </Quiet>
      ) : null}
      {data.nextCursor && (
        <button
          className="btn secondary full load-more"
          disabled={loading}
          onClick={() => void loadMore(data.nextCursor!)}
        >
          Load more conversations
        </button>
      )}
    </>
  );
  return (
    <div className="social-shell">
      <a
        className="skip-link"
        href="#social-main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("social-main")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="social-sidebar">
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="Polis home"
        >
          <Asterisk size={35} />
          <span>polis</span>
        </button>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, Icon }) => (
            <button
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "selected" : ""}
              key={id}
              onClick={() => navigate(id)}
            >
              <Icon size={21} />
              {label}
            </button>
          ))}
        </nav>
        {data.status === "ready" && (
          <button
            className="btn primary sidebar-compose"
            onClick={() => compose()}
          >
            <Plus size={17} />
            Share a thought
          </button>
        )}
        <div className="social-sidebar-bottom">
          <span>
            <MapPin size={18} />
            Ithaca, NY
          </span>
          {me && data.status === "ready" && (
            <button
              className="sidebar-person"
              onClick={() => navigate("profile")}
            >
              <Avatar initials={me.name[0]} />
              <span>
                {me.name}
                <small>@{me.username}</small>
              </span>
            </button>
          )}
          {me?.role === "owner" && (
            <button className="text-button" onClick={() => navigate("admin")}>
              <Settings size={16} />
              Community tools
            </button>
          )}
          <a href="/demo">
            Original browser-only demo <ArrowUpRight size={14} />
          </a>
          {data.status !== "signed_out" && (
            <a href="/signout-with-chatgpt?return_to=%2F" target="_top">
              <LogOut size={14} />
              Sign out
            </a>
          )}
        </div>
      </aside>
      <div className="social-body">
        <header className="social-topbar">
          <button
            className="brand social-mobile-brand"
            onClick={() => navigate("home")}
          >
            <Asterisk size={28} />
            <span>polis</span>
          </button>
          <div className="social-search">
            <Search size={18} />
            <input
              type="search"
              placeholder={
                view === "friends"
                  ? "Search names or usernames"
                  : "Search your community"
              }
              aria-label="Search your community"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-btn"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {data.status === "ready" ? (
            <>
              <span className="top-community">
                <MapPin size={16} />
                Ithaca, NY
              </span>
              <button
                className="notification-bell"
                onClick={() => navigate("notifications")}
                aria-label={
                  "Notifications, " +
                  data.notifications.filter((n) => !n.readAt).length +
                  " unread"
                }
              >
                <Bell size={21} />
                {data.notifications.some((n) => !n.readAt) && (
                  <span>
                    {data.notifications.filter((n) => !n.readAt).length}
                  </span>
                )}
              </button>
              <button
                className="btn primary top-compose"
                onClick={() => compose()}
              >
                <Plus size={17} />
                Post
              </button>
            </>
          ) : (
            <a className="btn secondary" href={signin} target="_top">
              Sign in with ChatGPT <ArrowRight size={16} />
            </a>
          )}
        </header>
        <main
          id="social-main"
          tabIndex={-1}
          className={
            "social-layout " +
            (["explore", "admin"].includes(view) ? "social-wide" : "")
          }
        >
          <section className="social-content">
            {localPreview && (
              <p className="local-preview-notice">
                Local preview · Test activity stays on this computer.
              </p>
            )}
            {title && (
              <div className="social-heading">
                <div>
                  <p>Ithaca & Cornell</p>
                  <h1>{title}</h1>
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="social-error">
                <p>{error}</p>
                <button onClick={() => void refresh()} className="text-button">
                  Try again
                </button>
              </div>
            )}
            {data.status === "signed_out" ? (
              <>
                <section className="daily-card">
                  <div className="social-section-label">
                    A PLACE FOR YOUR PERSPECTIVE
                  </div>
                  <h2>Understand an issue. Hear from a friend.</h2>
                  <p>
                    Join an invited community to share your views, ask a
                    question, and follow what happens next.
                  </p>
                  <a className="btn primary" href={signin} target="_top">
                    Sign in to Polis <ArrowRight size={16} />
                  </a>
                </section>
                <div className="social-demo-notice">
                  The original interactive demo remains available. Its people,
                  ratings, and events are fictional and saved only in your
                  browser.
                </div>
                <a className="post-subject" href="/demo">
                  <span>
                    EXPLORE THE MVP
                    <strong>Rank, read, and discover your community</strong>
                  </span>
                  <ArrowUpRight size={22} />
                </a>
              </>
            ) : data.status === "onboarding" ? (
              <Onboarding name={me!.name} run={run} />
            ) : (
              <>
                {view === "home" && (
                  <>
                    <DailyQuestion
                      key={
                        (data.question?.id ?? "") + JSON.stringify(data.answer)
                      }
                      data={data}
                      run={run}
                      navigate={navigate}
                    />
                    <button
                      className="social-composer-entry"
                      onClick={() => compose()}
                    >
                      <Avatar initials={me!.name[0]} />
                      <span>What’s on your mind, locally?</span>
                      <Plus size={20} />
                    </button>
                    <div
                      className="social-tabs"
                      role="tablist"
                      aria-label="Feed audience"
                    >
                      {[
                        { id: "friends", label: "Friends" },
                        { id: "following", label: "Followed issues" },
                        { id: "community", label: "Community" },
                      ].map((f) => (
                        <button
                          role="tab"
                          aria-selected={filter === f.id}
                          className={filter === f.id ? "active" : ""}
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <p className="feed-context">
                      {filter === "friends"
                        ? "Your contributions and accepted friends, newest first."
                        : filter === "following"
                          ? "Visible conversations on the issues you follow."
                          : "Posts shared with invited Ithaca community members."}
                    </p>
                    {feed}
                  </>
                )}
                {view === "explore" && (
                  <Explore query={query} navigate={navigate} data={data} />
                )}
                {view === "rankings" && (
                  <RankingList
                    data={data}
                    run={run}
                    rank={rank}
                    share={() => setShare(true)}
                    navigate={navigate}
                  />
                )}
                {view === "friends" && (
                  <Friends
                    data={data}
                    run={run}
                    navigate={navigate}
                    query={query}
                  />
                )}
                {view === "profile" && (
                  <Profile
                    person={
                      !id || id === me!.id
                        ? me!
                        : data.people.find((p) => p.id === id)
                    }
                    data={data}
                    run={run}
                    navigate={navigate}
                    edit={() => setEditing(true)}
                    report={setActionTarget}
                  >
                    {feed}
                  </Profile>
                )}
                {view === "post" && (
                  <>
                    {commentId &&
                      !loading &&
                      data.posts.length > 0 &&
                      !data.comments?.some((c) => c.id === commentId) && (
                        <p role="status" className="catalog-notice">
                          This reply was removed or is no longer available to
                          you. You can still read the conversation below.
                        </p>
                      )}
                    <Conversation
                      data={data}
                      run={run}
                      navigate={navigate}
                      onEdit={editPost}
                      onReport={setActionTarget}
                      busy={busy}
                    />
                    {data.nextCommentCursor && (
                      <button
                        className="btn secondary full"
                        disabled={loading}
                        onClick={() =>
                          void loadComments(data.nextCommentCursor!)
                        }
                      >
                        Load more replies
                      </button>
                    )}
                  </>
                )}
                {view === "issue" && (
                  <IssueDetail
                    id={id}
                    data={data}
                    run={run}
                    navigate={navigate}
                    compose={compose}
                  >
                    {feed}
                  </IssueDetail>
                )}
                {view === "item" &&
                  (itemById[id] ? (
                    <ItemDetail
                      key={id}
                      item={itemById[id]}
                      data={data}
                      run={run}
                      navigate={navigate}
                      compose={(o) => {
                        const i = itemById[o.subjectId!];
                        setComposer({
                          ...o,
                          kind:
                            i?.kind === "News"
                              ? "article"
                              : i?.event
                                ? "event_reflection"
                                : "opinion",
                        } as ComposeOptions);
                      }}
                      rank={rank}
                    />
                  ) : (
                    <IssueDetail
                      id={id}
                      data={data}
                      run={run}
                      navigate={navigate}
                      compose={compose}
                    >
                      {feed}
                    </IssueDetail>
                  ))}
                {view === "list" && (
                  <>
                    {data.posts[0] && (
                      <>
                        <p className="catalog-notice">
                          Published selection · Later private changes do not
                          alter this list.
                        </p>
                        <PostCard
                          expanded
                          post={data.posts[0]}
                          me={me!}
                          run={run}
                          navigate={navigate}
                          onEdit={editPost}
                          onReport={setActionTarget}
                          busy={busy}
                        />
                        <button
                          className="btn secondary"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(location.href)
                              .then(() => toast.success("List link copied."))
                              .catch(() =>
                                toast.error(
                                  "Could not copy. Use the address above.",
                                ),
                              );
                          }}
                        >
                          Copy list link
                        </button>
                      </>
                    )}
                  </>
                )}
                {![
                  "home",
                  "explore",
                  "rankings",
                  "friends",
                  "profile",
                  "post",
                  "issue",
                  "item",
                  "list",
                  "notifications",
                  "admin",
                  "saved",
                ].includes(view) && (
                  <Quiet title="Page unavailable.">
                    <button
                      className="text-button"
                      onClick={() => navigate("home")}
                    >
                      Return to Home
                    </button>
                  </Quiet>
                )}
                {view === "notifications" && (
                  <Notifications data={data} run={run} navigate={navigate} />
                )}
                {view === "admin" && <Admin data={data} run={run} />}
                {view === "saved" && (
                  <>
                    <p className="catalog-notice">
                      <Lock size={14} /> Only you can see your saved items.
                    </p>
                    {data.saved
                      .filter((id) => itemById[id])
                      .map((id) => (
                        <button
                          key={id}
                          className="catalog-row"
                          onClick={() => navigate("item/" + id)}
                        >
                          <span>
                            <h2>{subjectTitle(id)}</h2>
                          </span>
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                    {feed}
                  </>
                )}
              </>
            )}
          </section>
          <aside className="social-rail">
            <section>
              <h2>
                {data.follows.length
                  ? "Following your curiosity"
                  : "Follow the things you care about."}
              </h2>
              {issues.slice(0, 4).map((issue, i) => (
                <div className="issue-rail-row" key={issue.id}>
                  <span className={"issue-square tone-" + i}>{i + 1}</span>
                  <button onClick={() => navigate("issue/" + issue.id)}>
                    {issue.name}
                  </button>
                  {data.status === "ready" && (
                    <button
                      className="icon-btn"
                      aria-label={
                        (data.follows.some((f) => f.issueId === issue.id)
                          ? "Unfollow "
                          : "Follow ") + issue.name
                      }
                      onClick={() => {
                        void run({
                          action: "follow",
                          issueId: issue.id,
                          enabled: !data.follows.some(
                            (f) => f.issueId === issue.id,
                          ),
                          notify: false,
                        }).catch(() => {});
                      }}
                    >
                      {data.follows.some((f) => f.issueId === issue.id) ? (
                        <Check size={17} />
                      ) : (
                        <Plus size={17} />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </section>
            <section>
              <div className="section-heading">
                <h2>Around the corner</h2>
                <button
                  aria-label="Explore events"
                  onClick={() => navigate("explore")}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
              <CommunityMap
                compact
                showFriends={false}
                onSelect={(i) => navigate("item/" + i.id)}
              />
              {items
                .filter((i) => i.event)
                .sort((a, b) => Number(a.event!.day) - Number(b.event!.day))
                .slice(0, 2)
                .map((i) => (
                  <button
                    className="social-event-row"
                    onClick={() => navigate("item/" + i.id)}
                    key={i.id}
                  >
                    <span className="social-date">
                      {i.event?.day}
                      <small>SEP</small>
                    </span>
                    <span>
                      <strong>{i.title}</strong>
                      <small>Sample · Sep {i.event?.day}, 2026</small>
                    </span>
                  </button>
                ))}
            </section>
            <p className="social-rail-note">
              A place for questions, different perspectives, and showing up
              together.
            </p>
          </aside>
        </main>
      </div>
      <nav className="social-mobile-nav" aria-label="Mobile navigation">
        {nav.map(({ id, label, Icon }) => (
          <button
            aria-current={view === id ? "page" : undefined}
            className={view === id ? "selected" : ""}
            key={id}
            onClick={() => navigate(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {composer && me && (
        <Composer
          onRanking={() => setShare(true)}
          options={composer}
          userId={me.id}
          run={run}
          navigate={navigate}
          onClose={() => setComposer(null)}
        />
      )}
      {rankOpen && (
        <RankDialog
          initialItem={rankItem}
          state={rankState}
          persisted
          onClose={() => setRankOpen(false)}
          onSave={async (r) => {
            await run({
              action: "ranking",
              itemId: r.itemId,
              score: r.score,
              note: r.note,
              position:
                data.rankings.find((o) => o.itemId === r.itemId)?.position ??
                null,
            });
          }}
          onCompare={async (a, b) => {
            const order = data.rankings.map((r) => r.itemId);
            if (!order.includes(a)) order.push(a);
            if (!order.includes(b)) order.push(b);
            const i = order.indexOf(a),
              j = order.indexOf(b);
            if (i > j) {
              order.splice(i, 1);
              order.splice(j, 0, a);
            }
            await run({ action: "ranking.order", itemIds: order });
          }}
        />
      )}
      {share && (
        <ShareRanking
          data={data}
          run={run}
          onClose={() => setShare(false)}
          navigate={navigate}
        />
      )}
      {actionTarget && (
        <ActionDialog
          target={actionTarget}
          run={run}
          navigate={navigate}
          onClose={() => setActionTarget("")}
        />
      )}
      {editing && (
        <EditProfile data={data} run={run} onClose={() => setEditing(false)} />
      )}
      <Toaster theme="light" />
    </div>
  );
}
