"use client";
import { InvitationEntry } from "./invitation-entry";
import { AccountSetup, SignInChoice } from "./account-entry";
import { CommonsView, WhatChanged, TrendingTopics, commonsParams, commonsTab } from "./commons";
import { OrganizationSpace } from "./organization-space";
import { topicsFor } from "@/lib/social/commons";
import { catalogOf, inCatalog } from "@/lib/social/civic";
import { localeOf } from "@/lib/social/communities";
import { FindCommunity } from "./find-community";
import { CivicMap, mapLayers, mapPins, type MapLayer } from "./civic-map";
import { LocalNewsList, useNewsRefresh } from "./local-news";
import { EntityPage } from "./entity-page";
import { HomeDashboard } from "./home-dashboard";
import { SearchView } from "./search-view";
import { CommunityGuidelines } from "./guidelines";
import { entityRoute } from "./civic-cards";
import {
  AroundEvents,
  CommunityEvents,
  CommunityEventDetail,
  EventCollections,
} from "./community-events";
import { EventManager } from "./event-manager";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import "./motion.css";
import { navigateTo, routeHref, subscribeRoute } from "@/lib/social/route";
import { ease, reducedMotion } from "@/lib/motion";
import { useArrivals } from "@/lib/social/use-arrivals";
import {
  Asterisk,
  House,
  Map as MapIcon,
  MessagesSquare,
  GraduationCap,
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
import type { CivicEntity, CommunityEvent, Post } from "@/lib/social/types";
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
// On a history traversal the framework scrolls hash routes to their (missing)
// anchor one frame later. When the page commits at once (reduced motion, or a
// hidden tab) that undid the restored position, so hold it for two frames.
function restoreScroll(top: number) {
  window.scrollTo({ top, behavior: "instant" });
  let frames = 2;
  const hold = () => {
    if (Math.abs(window.scrollY - top) > 1) window.scrollTo({ top, behavior: "instant" });
    if (--frames > 0) requestAnimationFrame(hold);
  };
  requestAnimationFrame(hold);
}

export default function SocialApp() {
  const browserLocation = useSyncExternalStore(subscribeRoute, routeHref, () => "/");
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
  const [searchQuery, setQuery] = useState(""),
    [composer, setComposer] = useState<ComposeOptions | null>(null),
    [rankItem, setRankItem] = useState<CivicItem | undefined>(),
    [rankOpen, setRankOpen] = useState(false),
    [share, setShare] = useState(false),
    [actionTarget, setActionTarget] = useState(""),
    [editing, setEditing] = useState(false);
  const [requestedView, id, commentId] = route.split("/");
  // Codex's in-progress forum lived at #home?coverage=…; those links now open
  // the dedicated Commons, and Home becomes the curated dashboard.
  const legacyForum =
    requestedView === "home" && ["coverage", "filter", "sort", "scope"].some((k) => exploreParams.has(k));
  // People type and share #map for the Map tab, whose route is #explore.
  const view =
    requestedView === "signup"
      ? "home"
      : legacyForum
        ? "commons"
        : requestedView === "topic"
          ? "entity"
          : requestedView === "map"
            ? "explore"
            : requestedView;
  const tab = commonsTab(
    legacyForum
      ? exploreParams.get("coverage") === "national"
        ? "national"
        : exploreParams.get("filter") === "conversations"
          ? "following"
          : "for-you"
      : id,
  );
  const query =
    view === "explore" || view === "search" ? (exploreParams.get("q") ?? "") : searchQuery;
  const params =
    view === "commons" ? commonsParams(tab, exploreParams) : new URLSearchParams({ filter: "all" });
  if (view === "home") {
    params.set("filter", "all");
    params.set("sort", "active");
    params.set("commons", "1");
  }
  if (view === "explore" && !id) params.set("commons", "1");
  if (view === "entity") {
    params.set("commons", "1");
    // The server decides from its catalog: issues include everything filed under them.
    params.set("entity", id ?? "");
  }
  if (view === "search") {
    params.set("commons", "1");
    if (query) params.set("q", query);
  }
  if (view === "commons" && searchQuery) params.set("q", searchQuery);
  if (exploreParams.has("community") && ["post", "list", "profile", "official", "news", "event", "entity"].includes(view)) params.set("community", exploreParams.get("community")!);
  if (view === "post" || view === "list") params.set("post", id ?? "");
  if (view === "post" && commentId) params.set("comment", commentId);
  if (view === "issue") params.set("issue", id ?? "");
  if (view === "event") params.set("event", id ?? "");
  if (view === "profile") params.set("author", id ?? "me");
  if (view === "organization") { params.set("organization", id ?? ""); params.set("channel", commentId ?? "discussion"); }
  if (view === "saved") params.set("filter", "saved");

  const { data, loading, pending, error, busy, run, refresh, loadMore, loadComments } =
    useSocial(params.toString());
  useNewsRefresh(data, refresh);
  const content = useRef<HTMLElement>(null);
  useArrivals(content, browserLocation);
  // The first view of a visit comes into focus, like the film's opening feed.
  const arrived = useRef(false);
  const signedIn = !!data.me;
  useLayoutEffect(() => {
    if (!signedIn || arrived.current || !content.current) return;
    arrived.current = true;
    if (!reducedMotion())
      content.current.animate([{ opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 900, easing: ease.smooth });
  }, [signedIn]);
  const me = data.me;
  const catalog = catalogOf(data);
  const locale = localeOf(data.community);
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
  const committedLocation = useRef(browserLocation);
  const replyRequested = exploreParams.get("reply") === "1";
  useLayoutEffect(() => {
    committedLocation.current = browserLocation;
    restoreLocation.current = browserLocation;
    // A view already on screen (returning to it) is restored before the page
    // transition captures it, so it slides back in at the place you left.
    if (pending && data.posts.length && !commentId && !replyRequested) {
      const top = scrollPositions.current.get(browserLocation);
      if (top) restoreScroll(top);
      restoreLocation.current = "";
    }
    // Only a route change restores; later data for the same route does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserLocation]);
  useEffect(() => {
    // Scrolls while a view awaits its restore come from the browser or the
    // framework (hash anchors), not the reader; they must not replace the
    // position being restored.
    const save = () => {
      if (restoreLocation.current !== committedLocation.current)
        scrollPositions.current.set(committedLocation.current, window.scrollY);
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);
  useEffect(() => {
    if (loading || restoreLocation.current !== browserLocation) return;
    const frame = requestAnimationFrame(() => {
      if (view === "post" && replyRequested) {
        const input = document.querySelector<HTMLTextAreaElement>("#discussion-reply textarea");
        if (!input) return;
        input.focus();
      } else if (!commentId) restoreScroll(scrollPositions.current.get(browserLocation) ?? 0);
      // Consume only after the frame runs. A loading render can cancel a frame
      // before the thread mounts; its next ready render must retry restoration.
      restoreLocation.current = "";
    });
    return () => cancelAnimationFrame(frame);
  }, [browserLocation, loading, view, commentId, replyRequested, data.posts]);
  function navigate(next: string, options: { preserveScroll?: boolean } = {}) {
    const destination = new URL(next, "https://polis.invalid/");
    if (["post", "list", "profile", "event", "official", "news", "entity", "topic"].includes(destination.pathname.split("/")[1]) && data.community && !destination.searchParams.has("community")) {
      destination.searchParams.set("community", data.community.id);
      next = destination.pathname.slice(1) + destination.search;
    }
    if (destination.pathname.slice(1) === route) options = { ...options, preserveScroll: true };
    scrollPositions.current.set(location.href, window.scrollY);
    if (options.preserveScroll) scrollPositions.current.set(location.origin + location.pathname + location.search + "#" + next, window.scrollY);
    if (location.hash === "#" + next) {
      return;
    }
    navigateTo("#" + next, () => setQuery(""), options);
  }
  function search(value: string) {
    if (view !== "explore" && view !== "search") {
      setQuery(value);
      return;
    }
    const p = new URLSearchParams(exploreParams);
    if (value) p.set("q", value);
    else p.delete("q");
    history.replaceState(history.state, "", "#" + route + (p.size ? "?" + p : ""));
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  function compose(o: ComposeOptions = {}) {
    if (view === "commons" && tab === "national" && exploreParams.get("scope") === "polis" && !data.nationalJoined) {
      toast.error("Join Across Polis before starting a wider conversation."); return;
    }
    if (data.status !== "ready") {
      location.assign(signin);
      return;
    }
    setComposer({
      coverage: view === "commons" && tab === "national" ? "national" : "local",
      ...(view === "commons" ? { audience: "community" as const } : {}),
      ...(data.community?.id !== "ithaca" ? { subjectId: "community", communityOnly: true } : {}),
      catalog,
      ...o,
      subjectLabel: data.events.find((e) => e.id === o.subjectId)?.title,
    });
  }
  // The bridge from a place, office or event into The Commons.
  function discuss(entity: CivicEntity) {
    if (entity.kind === "question") navigate(entityRoute(entity.id));
    else compose({ subjectId: entity.id, kind: "debate", audience: "community", coverage: entity.scope === "national" ? "national" : "local" });
  }
  function discussEvent(event: CommunityEvent) {
    compose({ subjectId: event.id, kind: "question", audience: "community", coverage: "local" });
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
    { id: "commons", label: "Commons", Icon: MessagesSquare },
    { id: "explore", label: "Map", Icon: MapIcon },
    { id: "rankings", label: "Rankings", Icon: ChartNoAxesColumnIncreasing, desktopOnly: true },
    { id: "friends", label: "Friends", Icon: Users },
    { id: "profile", label: "Profile", Icon: UserRound },
  ];
  const mapLayer = (mapLayers.some((l) => l.id === exploreParams.get("layer")) ? exploreParams.get("layer") : "all") as MapLayer;
  const layersPresent = new Set(view === "explore" ? mapPins(data).map((p) => p.layer) : []);
  const selectMapPin = (pin: string) => {
    const next = new URLSearchParams(exploreParams);
    if (pin) next.set("selected", pin);
    else next.delete("selected");
    navigate("explore" + (next.size ? "?" + next : ""), { preserveScroll: true });
  };
  const title =
    view === "home" || view === "commons"
      ? ""
      : view === "explore"
        ? !id
          ? ""
          : id === "events"
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
      compact={view === "commons" || view === "search"}
      catalog={catalog}
      communityName={data.community?.name}
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
        <div className="skeleton-list" role="status">
          <span className="sr-only">Loading your conversations…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : !posts.length && !error ? (
        <Quiet
          title={
            view === "commons" && tab === "following"
              ? "Follow a thread, topic or friend to fill this view."
              : view === "commons" && tab === "trending"
                ? "Nothing is drawing a crowd yet this week."
                : "A little room for a new perspective."
          }
        >
          {view === "commons" && tab === "following" ? (
            <>
              Follow a local topic or place, or add a friend.{" "}
              <button
                className="text-button"
                onClick={() => navigate("explore")}
              >
                Explore the map <ArrowRight size={14} />
              </button>
            </>
          ) : view === "commons" ? (
            "Start the first conversation here — a question, a debate or a sourced update."
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
      <aside className="social-sidebar" data-vt-name="polis-rail">
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
        <header className="social-topbar" data-vt-name="polis-topbar">
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
              // One search across people, places, issues, events and discussions.
              if (view !== "friends" && !(view === "explore" && id === "events") && query.trim())
                navigate("search?q=" + encodeURIComponent(query.trim()));
            }}
          >
            <Search size={18} />
            <input
              type="search"
              placeholder={
                view === "friends"
                  ? "Search names or usernames"
                  : view === "explore" && id === "events"
                    ? "Search events and places"
                    : view === "commons"
                      ? "Search The Commons · Enter for everything"
                      : "Search people, places, issues, events…"
              }
              aria-label={
                view === "friends"
                  ? "Search people"
                  : view === "explore" && id === "events"
                    ? "Search events and places"
                    : "Search Polis; press Enter for all results"
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
                <select aria-label="Current community" value={me?.activeCommunityId ?? data.community?.id ?? "ithaca"} disabled={busy} onChange={e => { if (e.target.value === "join") { navigate("join"); return; } if (e.target.value === "find") { navigate("communities"); return; } if (e.target.value === "join-open") { void run({ action: "community.joinOpen" }).then(() => navigate("home")).catch(() => {}); return; } if (e.target.value.startsWith("campus:")) { void run({ action: "community.join", communityId: e.target.value.slice(7) }).then(() => navigate("home")).catch(() => {}); return; } void run({ action: "community.select", communityId: e.target.value }).then(() => navigate("home")).catch(() => {}); }}>
                  {data.communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {data.eligibleCommunity && <option value={"campus:" + data.eligibleCommunity.id}>Join {data.eligibleCommunity.name} with your university email</option>}
                  {!data.communities.some(c => c.id === "polis") && <option value="join-open">Polis commons · Open to everyone</option>}
                  <option value="find">Find or start a community…</option>
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
                  <span key={data.notifications.filter((n) => !n.readAt).length}>
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
              "home",
            ].includes(view)
              ? "social-wide"
              : "") +
            (view === "explore" && id === "events" ? " events-wide" : "") +
            ((view === "explore" && !id) || view === "home" ? " civic-wide" : "")
          }
        >
          <section className="social-content" ref={content}>
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
              currentLocation.searchParams.has("invite") ? <Onboarding name={me!.name} run={run} /> : <AccountSetup name={me!.name} run={run} campus={data.eligibleCommunity} onCreated={() => navigate(data.eligibleCommunity ? "home" : "communities")} />
            ) : view === "organization" ? (
              <OrganizationSpace key={data.community?.id + ":" + id} id={id} channel={commentId} data={data} run={run} navigate={navigate} compose={compose}>{posts}</OrganizationSpace>
            ) : data.community?.id !== "ithaca" && (["item"].includes(view) || (view === "issue" && !inCatalog(catalog, id)) || (view === "rankings" && !catalog.some((e) => e.kind === "issue")) || (view === "explore" && id && id !== "events")) ? (
              <Quiet title="Local coverage is coming.">The original sample catalog belongs to Cornell / Ithaca. Offices, places and issues for this community are on the map. <button className="text-button" onClick={() => navigate("explore")}>Open the map</button></Quiet>
            ) : (
              <>
                {view === "home" && (
                  <HomeDashboard selected={exploreParams.get("selected") ?? ""} data={data} run={run} navigate={navigate} discuss={discuss} discussEvent={discussEvent}>
                    {data.eligibleCommunity && (
                      <div className="campus-eligible">
                        <GraduationCap size={20} aria-hidden="true" />
                        <p>
                          <strong>Your sign-in email is associated with {data.eligibleCommunity.campus?.university ?? data.eligibleCommunity.name}.</strong>{" "}
                          Join its community to see campus discussions and local civic life. This is community membership, not verification of student status.
                        </p>
                        <button className="btn primary small-btn" disabled={busy} onClick={() => void run({ action: "community.join", communityId: data.eligibleCommunity!.id }).catch(() => {})}>
                          Join {data.eligibleCommunity.name}
                        </button>
                      </div>
                    )}
                  </HomeDashboard>
                )}
                {view === "commons" && (
                  <CommonsView data={data} run={run} tab={tab} params={exploreParams} navigate={navigate} compose={compose} busy={busy}>
                    {tab === "news" ? <LocalNewsList data={data} navigate={navigate} discuss={discuss} /> : feed}
                  </CommonsView>
                )}
                {view === "explore" && !id && (
                  <section className="civic-map-page">
                    <header className="commons-header">
                      <p className="social-section-label">MAP · {(data.community?.name ?? "").toUpperCase()}</p>
                      <h1>{data.community?.campus ? "Around " + data.community.campus.shortName + " and " + data.community.campus.city + "." : locale ? "Around " + locale.city + "." : "Your community, on the map."}</h1>
                      <p>Offices, public buildings, campus places, proposals and upcoming events. Choose any marker to see why it matters and discuss it in The Commons.</p>
                    </header>
                    <div className="map-layer-chips" role="group" aria-label="Map layers">
                      {/* Only kinds this community has on the map, so a town without
                          campus places is not offered an empty Campus layer. */}
                      {mapLayers.filter((l) => l.id === "all" || l.id === mapLayer || layersPresent.has(l.id)).map((l) => (
                        <button
                          key={l.id}
                          aria-pressed={mapLayer === l.id}
                          onClick={() => {
                            const next = new URLSearchParams(exploreParams);
                            next.set("layer", l.id);
                            next.delete("selected");
                            navigate("explore?" + next, { preserveScroll: true });
                          }}
                        >
                          {l.label}
                        </button>
                      ))}
                      <span />
                      <button onClick={() => navigate("explore/events")}>Event list</button>
                    </div>
                    {locale && !data.places?.length && catalog.every((e) => e.id.startsWith((data.community?.id ?? "") + ".")) && (
                      <div className="notice places-empty">
                        <p>
                          <strong>No public places on this map yet.</strong> Add civic places such as the town hall, libraries,
                          courthouses and parks from OpenStreetMap.
                        </p>
                        <button
                          className="btn secondary small-btn"
                          disabled={busy}
                          onClick={() =>
                            void run({ action: "places.import" })
                              .then((r) => toast.success(r.recent ? "Places were updated recently." : (r.imported ?? 0) + " public places added."))
                              .catch(() => {})
                          }
                        >
                          Add public places
                        </button>
                      </div>
                    )}
                    {locale ? (
                      <CivicMap
                        data={data}
                        run={run}
                        navigate={navigate}
                        discuss={discuss}
                        discussEvent={discussEvent}
                        layer={mapLayer}
                        selected={exploreParams.get("selected") ?? ""}
                        onSelect={selectMapPin}
                      />
                    ) : (
                      <Quiet title="Your map appears with a local community.">Find or start the commons for your town or campus to see public places, offices and events near you. <button className="text-button" onClick={() => navigate("communities")}>Find your community</button></Quiet>
                    )}
                  </section>
                )}
                {view === "entity" && (
                  <EntityPage key={id} id={id} data={data} run={run} navigate={navigate} compose={compose}>
                    {feed}
                  </EntityPage>
                )}
                {view === "search" && (
                  <SearchView query={query} data={data} navigate={navigate} loading={loading}>
                    {posts}
                  </SearchView>
                )}
                {view === "guidelines" && <CommunityGuidelines navigate={navigate} />}
                {view === "communities" && <FindCommunity data={data} run={run} refresh={refresh} navigate={navigate} busy={busy} />}
                {view === "explore" &&
                  id === "events" && !commentId && (
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
                  <>
                    <EventCollections data={data} run={run} navigate={navigate} />
                    <button className="btn secondary profile-rankings-link" onClick={() => navigate("rankings")}>
                      Your issue priorities & rankings <ArrowRight size={15} />
                    </button>
                  </>
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
                      pending={pending}
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
                {view === "issue" && inCatalog(catalog, id) && (
                  <EntityPage key={id} id={id} data={data} run={run} navigate={navigate} compose={compose}>
                    {feed}
                  </EntityPage>
                )}
                {view === "issue" && !inCatalog(catalog, id) && (
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
                  "commons",
                  "entity",
                  "search",
                  "guidelines",
                  "communities",
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
            {data.status === "ready" && view === "commons" && tab !== "trending" && <TrendingTopics data={data} navigate={navigate} />}
            {data.status === "ready" && <WhatChanged communityId={data.community?.id ?? ""} navigate={navigate} />}
            <section>
              <h2>
                {data.follows.length
                  ? "Following your curiosity"
                  : "Follow the things you care about."}
              </h2>
              {(data.status === "ready" ? catalog.filter((e) => e.kind === "issue") : issues).slice(0, 5).map((issue, i) => (
                <div className="issue-rail-row" key={issue.id}>
                  <span className={"issue-square tone-" + (i % 3)}>{i + 1}</span>
                  <button onClick={() => navigate((data.status === "ready" ? "entity/" : "issue/") + issue.id)}>
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
              {data.status === "ready" && !topicsFor(data.community?.id ?? "").length && !catalog.some((e) => e.kind === "issue") && <p>Local topics are still being curated. Start a community conversation in the meantime.</p>}
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
      {data.status === "ready" && <nav className="social-mobile-nav" aria-label="Mobile navigation" data-vt-name="polis-tabbar">
        {nav.filter((n) => !n.desktopOnly).map(({ id, label, Icon }) => (
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
          options={{ ...composer, communityOnly: data.community?.id !== "ithaca", communityId: data.community?.id, communityName: data.community?.name, catalog }}
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
