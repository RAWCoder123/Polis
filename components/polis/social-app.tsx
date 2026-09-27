"use client";
import { InvitationEntry } from "./invitation-entry";
import { AccountSetup, SignInChoice } from "./account-entry";
import { CommonsIntro, CommonsTopicDetail, WhatChanged } from "./commons";
import { OrganizationSpace } from "./organization-space";
import { topicFor, topicsFor } from "@/lib/social/commons";
import {
  AroundEvents,
  CommunityEvents,
  CommunityEventDetail,
  EventCollections,
} from "./community-events";
import { EventManager } from "./event-manager";
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
import { itemById, type CivicItem } from "@/lib/polis-data";
import type { Post } from "@/lib/social/types";
import type { DemoState } from "@/lib/polis-state";
import { useSocial } from "@/lib/social/use-social";
import { issues, subjectTitle } from "@/lib/social/catalog";
import { Avatar } from "./common";
import { RankDialog } from "./dialogs";
import { PostCard } from "./social-post";
import {
  ActionDialog,
  Composer,
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
  const hashLocation = new URL(
    currentLocation.hash.slice(1) || "home",
    "https://polis.invalid/",
  );
  const route = hashLocation.pathname.slice(1);
  const exploreParams = hashLocation.searchParams;
  const filter = exploreParams.get("filter") ?? "community";
  const coverage = exploreParams.get("coverage") === "national" ? "national" : "local";
  const nationalScope = exploreParams.get("scope") === "polis" ? "polis" : "campus";
  const [searchQuery, setQuery] = useState(""),
    [composer, setComposer] = useState<ComposeOptions | null>(null),
    [rankItem, setRankItem] = useState<CivicItem | undefined>(),
    [rankOpen, setRankOpen] = useState(false),
    [share, setShare] = useState(false),
    [actionTarget, setActionTarget] = useState(""),
    [editing, setEditing] = useState(false);
  const [requestedView, id, commentId] = route.split("/");
  const view = requestedView === "signup" ? "home" : requestedView;
  const query =
    view === "explore" ? (exploreParams.get("q") ?? "") : searchQuery;
  const params = new URLSearchParams();
  params.set("filter", view === "home" ? filter : "all");
  if (view === "home") {
    params.set("coverage", coverage);
    params.set("sort", exploreParams.get("sort") ?? "new");
    if (coverage === "national") params.set("scope", nationalScope);
  }
  if (exploreParams.has("community") && ["post", "list", "profile", "official", "news", "event"].includes(view)) params.set("community", exploreParams.get("community")!);
  if (view === "post" || view === "list") params.set("post", id ?? "");
  if (view === "post" && commentId) params.set("comment", commentId);
  if (view === "issue" || view === "topic") params.set("issue", id ?? "");
  if (view === "event") params.set("event", id ?? "");
  if (view === "profile") params.set("author", id ?? "me");
  if (view === "organization") { params.set("organization", id ?? ""); params.set("channel", commentId ?? "discussion"); }
  if (view === "saved") params.set("filter", "saved");
  if (query && view === "home") params.set("q", query);
  const { data, loading, error, busy, run, refresh, loadMore, loadComments } =
    useSocial(params.toString());
  const me = data.me;
  const threadVisit = useRef("");
  useEffect(() => {
    if (view !== "post" || !data.posts.some(p => p.id === id) || data.status !== "ready") return;
    const key = data.community?.id + ":" + id;
    if (threadVisit.current === key) return;
    threadVisit.current = key;
    void run({ action: "conversation.visit", postId: id }).catch(() => {});
  }, [view, id, data.posts, data.status, data.community?.id, run]);
  useEffect(() => {
    if (view !== "post" || !commentId || loading) return;
    document
      .getElementById("comment-" + commentId)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [view, commentId, loading]);
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
  const scrollPositions = useRef(new Map<string, number>());
  const restoreLocation = useRef("");
  useEffect(() => {
    restoreLocation.current = browserLocation;
    const save = () => scrollPositions.current.set(browserLocation, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [browserLocation]);
  useEffect(() => {
    if (loading || restoreLocation.current !== browserLocation) return;
    restoreLocation.current = "";
    const frame = requestAnimationFrame(() => {
      if (view === "post" && exploreParams.get("reply") === "1") {
        document.querySelector<HTMLTextAreaElement>("#discussion-reply textarea")?.focus();
      } else if (!commentId) window.scrollTo({ top: scrollPositions.current.get(browserLocation) ?? 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [browserLocation, loading, view, commentId, exploreParams]);
  function updateForum(key: string, value: string) {
    const next = new URLSearchParams(exploreParams); next.set(key, value);
    navigate("home?" + next, { preserveScroll: true });
  }
  function navigate(next: string, options: { preserveScroll?: boolean } = {}) {
    const destination = new URL(next, "https://polis.invalid/");
    if (["post", "list", "profile", "event", "official", "news"].includes(destination.pathname.split("/")[1]) && data.community && !destination.searchParams.has("community")) {
      destination.searchParams.set("community", data.community.id);
      next = destination.pathname.slice(1) + destination.search;
    }
    scrollPositions.current.set(location.href, window.scrollY);
    if (options.preserveScroll) scrollPositions.current.set(location.origin + location.pathname + location.search + "#" + next, window.scrollY);
    if (location.hash === "#" + next) {
      return;
    }
    window.location.assign("#" + next);
    setQuery("");
    if (!options.preserveScroll)
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  function search(value: string) {
    if (view !== "explore") {
      setQuery(value);
      return;
    }
    const p = new URLSearchParams(exploreParams);
    if (value) p.set("q", value);
    else p.delete("q");
    history.replaceState(null, "", "#" + route + (p.size ? "?" + p : ""));
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  function compose(o: ComposeOptions = {}) {
    if (data.status !== "ready") {
      location.href = signin;
      return;
    }
    setComposer({
      coverage: view === "home" ? coverage : "local",
      ...(data.community?.id !== "ithaca" ? { subjectId: "community", communityOnly: true } : {}),
      ...o,
      subjectLabel: data.events.find((e) => e.id === o.subjectId)?.title,
    });
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
    { id: "home", label: "Commons", Icon: House },
    { id: "explore", label: "Explore", Icon: Compass },
    { id: "rankings", label: "Rankings", Icon: ChartNoAxesColumnIncreasing },
    { id: "friends", label: "Friends", Icon: Users },
    { id: "profile", label: "Profile", Icon: UserRound },
  ];
  const title =
    view === "home"
      ? "Your community’s Commons."
      : view === "explore"
        ? id === "events"
          ? "Find a reason to show up."
          : "Your community, a little closer."
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
      compact={view === "home"}
      unread={data.notifications.some(n => n.targetId === post.id && !!n.commentId && !n.readAt)}
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
            {data.community?.name ?? "Your community"}
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
          {data.status === "ready" && <button className="text-button" onClick={() => navigate("join")}>Enter invite code</button>}
          {me?.role === "curator" && (
            <button
              className="text-button"
              onClick={() => navigate("event-manager")}
            >
              <Settings size={16} />
              Manage events
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
          <form
            className="social-search"
            onSubmit={(e) => {
              e.preventDefault();
              if (!["home", "friends", "explore"].includes(view))
                navigate("explore/issues?q=" + encodeURIComponent(query));
            }}
          >
            <Search size={18} />
            <input
              type="search"
              placeholder={
                view === "friends"
                  ? "Search names or usernames"
                  : view === "home"
                    ? "Search conversations"
                    : view === "explore"
                      ? !id || id === "events"
                        ? "Search events and places"
                        : "Search the civic catalog"
                      : "Search local issues · Enter"
              }
              aria-label={
                view === "home"
                  ? "Search conversations"
                  : view === "friends"
                    ? "Search people"
                    : view === "explore"
                      ? !id || id === "events"
                        ? "Search events and places"
                        : "Search the civic catalog"
                      : "Search local issues; press Enter"
              }
              value={query}
              onChange={(e) => search(e.target.value)}
            />
            {query && (
              <button
                className="icon-btn"
                onClick={() => search("")}
                type="button"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </form>
          {data.status === "ready" ? (
            <>
              <label className="top-community"><span className="sr-only">Current community</span>
                <select aria-label="Current community" value={me?.activeCommunityId ?? data.community?.id ?? "ithaca"} disabled={busy} onChange={e => { if (e.target.value === "join") { navigate("join"); return; } if (e.target.value === "join-open") { void run({ action: "community.joinOpen" }).then(() => navigate("home")).catch(() => {}); return; } void run({ action: "community.select", communityId: e.target.value }).then(() => navigate("home")).catch(() => {}); }}>
                  {data.communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {!data.communities.some(c => c.id === "polis") && <option value="join-open">Polis commons · Open to everyone</option>}
                  <option value="join">Join with a community code…</option>
                </select>
              </label>
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
          ) : me ? (
            <span className="account-session-label">Signed in</span>
          ) : (
            <a className="btn secondary" href={signin} target="_top">
              Sign up / Log in <ArrowRight size={16} />
            </a>
          )}
        </header>
        <main
          id="social-main"
          tabIndex={-1}
          className={
            "social-layout " +
            ([
              "explore",
              "admin",
              "event-collections",
              "event-manager",
            ].includes(view)
              ? "social-wide"
              : "") +
            (view === "explore" && id === "events" ? " events-wide" : "")
          }
        >
          <section className="social-content">
            {localPreview && (
              <p className="local-preview-notice">
                Local preview · Test activity stays on this computer.
              </p>
            )}
            {title && data.status === "ready" && (
              <div className="social-heading">
                <div>
                  <p>{data.community?.name ?? "Your community"}</p>
                  <h1>{title}</h1>
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="social-error">
                <p>{error}</p>
                <button onClick={() => void refresh()} className="text-button">
                  Reload page data
                </button>
              </div>
            )}
            {loading && !data.me ? (
              <p className="notice" role="status">
                Loading your community…
              </p>
            ) : view === "join" ? (
              <InvitationEntry key={id} expectedCommunityId={id} data={data} run={run} onJoined={organizationId => { navigate(organizationId ? "organization/" + organizationId : "home"); toast.success("You’re in. Welcome to your community."); }} />
            ) : data.status === "signed_out" ? (
              <SignInChoice returnTo={currentLocation.pathname + currentLocation.search + currentLocation.hash} />
            ) : data.status === "onboarding" ? (
              currentLocation.searchParams.has("invite") ? <Onboarding name={me!.name} run={run} /> : <AccountSetup name={me!.name} run={run} onCreated={() => navigate("home")} />
            ) : view === "topic" ? (
              topicFor(id)?.communityId === data.community?.id ? <CommonsTopicDetail topic={topicFor(id)!} data={data} run={run} compose={compose} navigate={navigate}>{posts}</CommonsTopicDetail> : <Quiet title="This topic is unavailable.">Switch to a community you belong to and open its local topics.</Quiet>
            ) : view === "organization" ? (
              <OrganizationSpace key={data.community?.id + ":" + id} id={id} channel={commentId} data={data} run={run} navigate={navigate} compose={compose}>{posts}</OrganizationSpace>
            ) : data.community?.id !== "ithaca" && (["rankings", "issue", "item"].includes(view) || (view === "explore" && id && id !== "events")) ? (
              <Quiet title="Local coverage is coming.">This community’s issues and rankings have not been curated yet. Your existing saves remain with your account. <button className="text-button" onClick={() => navigate("home")}>See community conversations</button></Quiet>
            ) : (
              <>
                {view === "home" && (
                  <>
                    <div className="forum-scope social-tabs" role="tablist" aria-label="Discussion scope">
                      {["local", "national"].map(value => <button key={value} role="tab" aria-selected={coverage === value} className={coverage === value ? "active" : ""} onClick={() => updateForum("coverage", value)}>{value === "local" ? "Local" : "National"}</button>)}
                    </div>
                    {coverage === "national" && <div className="national-scope"><div className="event-mode-switch" aria-label="National discussion audience"><button aria-pressed={nationalScope === "campus"} onClick={() => updateForum("scope", "campus")}>My campus</button><button aria-pressed={nationalScope === "polis"} onClick={() => updateForum("scope", "polis")}>Across Polis</button></div><p className="metadata">{nationalScope === "campus" ? "National issues, discussed within your selected community." : "A separate, wider conversation for registered Polis members. Existing campus threads stay where they were published."}</p></div>}
                    {coverage === "national" && nationalScope === "polis" && !data.nationalJoined ? <section className="commons-background"><h2>Join the wider conversation</h2><p>Join the open Polis community to read and deliberately publish national discussions. Your selected campus and its private conversations stay unchanged.</p><button className="btn primary" disabled={busy} onClick={() => void run({ action: "community.joinNational" }).catch(() => {})}>Join Across Polis</button></section> : <>
                    <button className="social-composer-entry" onClick={() => compose({ subjectId: "community", kind: "question" })}><Avatar initials={me!.name[0]} /><span>Start a conversation{coverage === "national" ? " about a national issue" : " in your community"}</span><Plus size={20}/></button>
                    <div className="forum-filters" aria-label="Conversation order">
                      <button aria-pressed={filter !== "conversations" && exploreParams.get("sort") !== "active"} onClick={() => { const next = new URLSearchParams(exploreParams); next.set("sort", "new"); next.set("filter", "community"); navigate("home?" + next, { preserveScroll: true }); }}>New</button>
                      <button aria-pressed={filter !== "conversations" && exploreParams.get("sort") === "active"} onClick={() => { const next = new URLSearchParams(exploreParams); next.set("sort", "active"); next.set("filter", "community"); navigate("home?" + next, { preserveScroll: true }); }}>Recently active</button>
                      <button aria-pressed={filter === "conversations"} onClick={() => updateForum("filter", "conversations")}>Following</button>
                      <button aria-pressed={filter === "friends"} onClick={() => updateForum("filter", "friends")}>Friends</button>
                    </div>
                    <p className="feed-context">{filter === "conversations" ? "Threads you follow. Only activity you can access appears here." : "Member perspectives · " + (coverage === "local" ? "Campus & town" : nationalScope === "polis" ? "Across Polis" : "Within your community")}</p>
                    {feed}
                    </>}
                    {coverage === "local" && <><AroundEvents data={data} run={run} navigate={navigate}/><CommonsIntro data={data} compose={compose} navigate={navigate} run={run}/></>}
                  </>
                )}
                {view === "explore" &&
                  (!id || (id === "events" && !commentId)) && (
                    <CommunityEvents
                      data={data}
                      run={run}
                      navigate={navigate}
                      params={exploreParams}
                      query={query}
                    />
                  )}
                {view === "event-collections" && (
                  <CommunityEvents
                    data={data}
                    run={run}
                    navigate={navigate}
                    params={exploreParams}
                    collection={id}
                  />
                )}
                {view === "event" && (
                  <CommunityEventDetail
                    key={
                      id +
                      ":" +
                      JSON.stringify(
                        data.plans.find(
                          (p) => p.eventId === id && p.userId === me?.id,
                        ),
                      )
                    }
                    id={id}
                    data={data}
                    run={run}
                    navigate={navigate}
                    compose={compose}
                    report={setActionTarget}
                  >
                    {feed}
                  </CommunityEventDetail>
                )}
                {view === "event-manager" && (
                  <EventManager key={data.community?.id} data={data} run={run} navigate={navigate} />
                )}
                {view === "explore" &&
                  id &&
                  (id !== "events" || !!commentId) && (
                    <Explore
                      query={query}
                      navigate={navigate}
                      explore={(next) =>
                        navigate(next, { preserveScroll: true })
                      }
                      data={data}
                      run={run}
                      category={id}
                      selectedId={commentId}
                      params={exploreParams}
                    />
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
                    section={id}
                    busy={busy}
                  />
                )}
                {view === "profile" && (!id || id === me!.id) && (
                  <EventCollections data={data} run={run} navigate={navigate} />
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
                            o.kind ??
                            (i?.kind === "News"
                              ? "article"
                              : i?.event
                                ? "event_reflection"
                                : "opinion"),
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
                  "event",
                  "event-collections",
                  "event-manager",
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
                {view === "admin" && (
                  <>
                    <button
                      className="btn primary"
                      onClick={() => navigate("event-manager")}
                    >
                      Manage event listings & suggestions
                    </button>
                    <Admin key={data.community?.id} data={data} run={run} />
                  </>
                )}
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
            {data.status === "ready" && <WhatChanged communityId={data.community!.id} navigate={navigate} />}
            <section>
              <h2>
                {data.follows.length
                  ? "Following your curiosity"
                  : "Follow the things you care about."}
              </h2>
              {(data.status === "ready" ? topicsFor(data.community?.id ?? "") : issues).slice(0, 4).map((issue, i) => (
                <div className="issue-rail-row" key={issue.id}>
                  <span className={"issue-square tone-" + i}>{i + 1}</span>
                  <button onClick={() => navigate((topicFor(issue.id) ? "topic/" : "issue/") + issue.id)}>
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
              {data.status === "ready" && !topicsFor(data.community?.id ?? "").length && <p>Local topics are still being curated. Start a community conversation in the meantime.</p>}
            </section>
            {data.status === "ready" && (
              <AroundEvents data={data} run={run} navigate={navigate} />
            )}
            <p className="social-rail-note">
              A place for questions, different perspectives, and showing up
              together.
            </p>
          </aside>
        </main>
      </div>
      {data.status === "ready" && <nav className="social-mobile-nav" aria-label="Mobile navigation">
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
      </nav>}
      {composer && me && (
        <Composer
          onRanking={() => setShare(true)}
          options={{ ...composer, communityOnly: data.community?.id !== "ithaca", communityId: data.community?.id, communityName: data.community?.name }}
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
