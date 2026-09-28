"use client";
import "./civic.css";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  FileText,
  MessageCircle,
  MessagesSquare,
  Radio,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { topicsFor } from "@/lib/social/commons";
import type { CivicEntity, Snapshot } from "@/lib/social/types";
import { catalogOf, inCatalog } from "@/lib/social/civic";
import { localeOf } from "@/lib/social/communities";
import { EntityChip, KindLine, PerspectiveBar, entityRoute } from "./civic-cards";
import type { Navigate, Run } from "./social-post";
import type { ComposeOptions } from "./social-forms";

export type CommonsTab = "for-you" | "campus" | "local" | "national" | "trending" | "following";
export const commonsTabs: {
  id: CommonsTab;
  label: string;
  filter: string;
  campusOnly?: boolean;
  sortable?: boolean;
}[] = [
  { id: "for-you", label: "Recent", filter: "all", sortable: true },
  { id: "campus", label: "Campus", filter: "campus", campusOnly: true, sortable: true },
  { id: "local", label: "Local", filter: "all", sortable: true },
  { id: "national", label: "National", filter: "all", sortable: true },

  { id: "following", label: "Following", filter: "followed", sortable: true },
];
export const commonsTab = (id?: string): CommonsTab =>
  commonsTabs.some((t) => t.id === id) ? (id as CommonsTab) : "local";
// Query parameters for a Commons tab. Campus and Local are local coverage by
// subject; National keeps Codex's campus / Across Polis scope.
export function commonsParams(tab: CommonsTab, hash: URLSearchParams) {
  const t = commonsTabs.find((x) => x.id === tab) ?? commonsTabs.find(x => x.id === "local")!;
  const p = new URLSearchParams({ filter: hash.get("filter") === "followed" ? "followed" : hash.get("filter") === "all" ? "all" : t.filter, commons: "1" });
  if (tab === "campus" || tab === "local") p.set("coverage", "local");
  if (tab === "national") {
    p.set("coverage", "national");
    if (hash.get("scope") === "polis") p.set("scope", "polis");
  }
  if (t.sortable) p.set("sort", hash.get("sort") === "active" ? "active" : "new");
  return p;
}

// Starter questions ordered by what the viewer follows, then by participation.
export function rankedQuestions(data: Snapshot, scope?: "campus" | "local") {
  const followed = new Set(data.follows.map((f) => f.issueId));
  return catalogOf(data)
    .filter((e) => e.kind === "question" && (!scope || e.scope === scope))
    .map((e) => {
      const stats = data.commons?.questions.find((q) => q.id === e.id);
      const affinity = e.topics.some((t) => followed.has(t)) || followed.has(e.id) ? 2 : 0;
      return { e, stats, score: affinity + (stats?.participants ?? 0) };
    })
    .sort((a, b) => b.score - a.score || (b.e.debate?.openedAt ?? "").localeCompare(a.e.debate?.openedAt ?? ""));
}

export function QuestionCard({
  entity,
  data,
  navigate,
}: {
  entity: CivicEntity;
  data: Snapshot;
  navigate: Navigate;
}) {
  const stats = data.commons?.questions.find((q) => q.id === entity.id);
  const chips = entity.related.flatMap((id) => {
    const e = inCatalog(catalogOf(data), id);
    return e && e.kind !== "news" && e.kind !== "question" ? [e] : [];
  });
  return (
    <article className="question-card" data-morph>
      <KindLine entity={entity} />
      <h3>
        <button onClick={() => navigate(entityRoute(entity.id))}>{entity.name}</button>
      </h3>
      <p>{entity.summary}</p>
      <div className="chip-row">
        {chips.slice(0, 3).map((e) => (
          <EntityChip key={e.id} entity={e} navigate={navigate} />
        ))}
      </div>
      {stats && stats.positions.length > 0 && <PerspectiveBar counts={stats.positions} />}
      <footer>
        <span>
          <Users size={14} aria-hidden="true" />
          {stats?.participants
            ? stats.participants + (stats.participants === 1 ? " person" : " people") + " · " + stats.responses + (stats.responses === 1 ? " response" : " responses")
            : "Be the first to respond"}
        </span>
        <button className="text-button" onClick={() => navigate(entityRoute(entity.id))}>
          Join the discussion <ArrowRight size={14} />
        </button>
      </footer>
    </article>
  );
}

export function TrendingTopics({ data, navigate }: { data: Snapshot; navigate: Navigate }) {
  const topics = (data.commons?.topics ?? []).flatMap((t) => {
    const e = inCatalog(catalogOf(data), t.subjectId);
    return e && e.communityId === data.community?.id ? [{ e, t }] : [];
  });
  if (!topics.length) return null;
  return (
    <section className="trending-topics" aria-label="Topics people are discussing">
      <h2>
        <TrendingUp size={16} aria-hidden="true" /> Topics with the most people talking
      </h2>
      <div className="chip-row">
        {topics.map(({ e, t }) => (
          <button key={e.id} className="topic-chip" onClick={() => navigate(entityRoute(e.id))}>
            <strong>{e.name}</strong>
            <small>
              {t.participants} {t.participants === 1 ? "person" : "people"}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

// Codex's format choices, local topics, circle link and notification opt-in.
export function CommonsIntro({
  data,
  compose,
  navigate,
  run,
  coverage = "local",
  extrasOnly = false,
}: {
  data: Snapshot;
  compose: (o: ComposeOptions) => void;
  navigate: Navigate;
  run: Run;
  coverage?: "local" | "national";
  extrasOnly?: boolean;
}) {
  const topics = topicsFor(data.community?.id ?? "");
  const start = (kind: ComposeOptions["kind"]) =>
    compose({ kind, subjectId: "community", audience: "community", coverage });
  return (
    <section className="commons-intro">
      {!extrasOnly && <div className="commons-formats">
        <button onClick={() => start("question")}>
          <MessageCircle size={20} />
          <strong>Question</strong>
          <span>Ask your community</span>
        </button>
        <button onClick={() => start("debate")}>
          <MessagesSquare size={20} />
          <strong>Debate</strong>
          <span>Explore different views</span>
        </button>
        <button onClick={() => start("update")}>
          <Radio size={20} />
          <strong>Update</strong>
          <span>Share a sourced development</span>
        </button>
      </div>}
      {extrasOnly && topics.length > 0 && (
        <div className="commons-topics" aria-label="Local topics">
          {topics.map((t) => (
            <button key={t.id} className="btn secondary small-btn" onClick={() => navigate(entityRoute(t.id))}>
              {t.name}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      )}
      {extrasOnly && <div className="commons-links">
      {data.organizations?.map((o) => (
        <button
          key={o.id}
          className="text-button commons-organization-link"
          onClick={() => navigate(o.role ? "organization/" + o.id + "/discussion" : "join/" + data.community?.id)}
        >
          {o.name} · {o.role ? "Open space" : "Join with organization code"}
          <ArrowUpRight size={15} />
        </button>
      ))}
      {!data.preferences.replies && (
        <button
          className="text-button commons-notification-optin"
          onClick={() =>
            void run({
              action: "preferences",
              replies: true,
              reactions: !!data.preferences.reactions,
              issues: !!data.preferences.issues,
              events: !!data.preferences.events,
            }).catch(() => {})
          }
        >
          <Bell size={16} /> Enable in-app reply notifications
        </button>
      )}
      </div>}
    </section>
  );
}

export function WhatChanged({ communityId, navigate }: { communityId: string; navigate: Navigate }) {
  const topics = topicsFor(communityId);
  if (!topics.length) return null;
  return (
    <section className="commons-changed">
      <h2>What changed</h2>
      <p className="metadata">Source notes and background · Manually checked, not a live news feed</p>
      {topics.map((t) => (
        <button key={t.id} onClick={() => navigate(entityRoute(t.id))}>
          <FileText size={19} />
          <span>
            <strong>{t.documentTitle}</strong>
            <small>
              {t.publisher} · Checked {t.checkedAt}
            </small>
          </span>
          <ArrowUpRight size={15} />
        </button>
      ))}
    </section>
  );
}

export function CommonsView({
  data,
  run,
  tab,
  params,
  navigate,
  compose,
  busy,
  children,
}: {
  data: Snapshot;
  run: Run;
  tab: CommonsTab;
  params: URLSearchParams;
  navigate: Navigate;
  compose: (o: ComposeOptions) => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  const campus = data.community?.campus;
  const locale = localeOf(data.community);
  const tabs = commonsTabs.filter((t) => t.id === "local" || t.id === "national");
  const current = commonsTabs.find((t) => t.id === tab)!;
  const scope = tab === "campus" ? "campus" : tab === "local" ? "local" : undefined;
  const questions = ["for-you", "campus", "local"].includes(tab) ? rankedQuestions(data, scope).slice(0, 2) : [];
  const place = locale?.shortName ?? data.community?.name ?? "your community";
  const nationalScope = params.get("scope") === "polis" ? "polis" : "campus";
  // Member conversations precede optional starter questions.
  const openQuestions = questions.length > 0 && (
    <section className="commons-questions" aria-label="Starter questions">
      <h2>
        <MessagesSquare size={16} aria-hidden="true" /> Open questions
      </h2>
      <div className="question-grid">
        {questions.map(({ e }) => (
          <QuestionCard key={e.id} entity={e} data={data} navigate={navigate} />
        ))}
      </div>
    </section>
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    navigate("commons/" + tab + "?" + next);
  };
  return (
    <section className="commons">
      <header className="commons-header">
        <p className="social-section-label">THE COMMONS · {(data.community?.name ?? "").toUpperCase()}</p>
        <h1>What {place} is talking about.</h1>
        <p>
          Local life. National questions. Your community’s perspectives.
        </p>
      </header>
      {!(tab === "national" && nationalScope === "polis" && !data.nationalJoined) && <CommonsIntro data={data} compose={compose} navigate={navigate} run={run} coverage={tab === "national" ? "national" : "local"} />}
      <nav className="social-tabs commons-tabs" aria-label="Commons sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={(tab === "national" ? t.id === "national" : t.id === "local") ? "page" : undefined}
            className={(tab === "national" ? t.id === "national" : t.id === "local") ? "active" : ""}
            onClick={() => navigate("commons/" + t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "national" && (
        <div className="national-scope">
          <div className="event-mode-switch" aria-label="National discussion audience">
            <button aria-pressed={nationalScope === "campus"} onClick={() => update("scope", "campus")}>
              My campus
            </button>
            <button aria-pressed={nationalScope === "polis"} onClick={() => update("scope", "polis")}>
              Across Polis
            </button>
          </div>
          <p className="metadata">
            {nationalScope === "campus"
              ? "National issues, discussed within " + (data.community?.name ?? "your community") + "."
              : "A separate, wider conversation for registered Polis members. Campus threads stay where they were published."}
          </p>
        </div>
      )}
      {current.sortable && (
        <div className="forum-filters" aria-label="Conversation order">
          <button aria-pressed={params.get("sort") !== "active" && params.get("filter") !== "followed" && tab !== "following"} onClick={() => navigate("commons/" + tab + "?" + new URLSearchParams({ ...Object.fromEntries(params), sort: "new", filter: "all" }))}>
            New
          </button>
          <button aria-pressed={params.get("sort") === "active" && params.get("filter") !== "followed" && tab !== "following"} onClick={() => navigate("commons/" + tab + "?" + new URLSearchParams({ ...Object.fromEntries(params), sort: "active", filter: "all" }))}>
            Recently active
          </button>
          <button aria-pressed={params.get("filter") === "followed" || tab === "following"} onClick={() => update("filter", "followed")}>Following</button>
        </div>
      )}
      <p className="feed-context">
        {tab === "for-you"
          ? "Recent visible conversations, newest first."
          : tab === "campus"
            ? "About " + (campus?.shortName ?? "campus") + ": buildings, offices, student government and campus life."
            : tab === "local"
              ? "About " + (locale?.city ?? "the city") + ": housing, transit, local government, places and events."
              : tab === "national"
                ? "National issues. Local and national conversations keep separate threads."
                : tab === "trending"
                  ? "Conversations drawing the most people this week — counted by people taking part, not reactions."
                  : "Threads you follow, topics and places you follow, and your friends."}
      </p>
      {tab === "trending" && <TrendingTopics data={data} navigate={navigate} />}
      {tab === "national" && nationalScope === "polis" && !data.nationalJoined ? (
        <section className="commons-background">
          <h2>Join the wider conversation</h2>
          <p>
            Join the open Polis community to read and deliberately publish national discussions. Your selected campus
            and its private conversations stay unchanged.
          </p>
          <button className="btn primary" disabled={busy} onClick={() => void run({ action: "community.joinNational" }).catch(() => {})}>
            Join Across Polis
          </button>
        </section>
      ) : (
        children
      )}
      <section className="commons-source-shelf"><h2>{tab === "national" ? "National source notes" : "Local source notes"}</h2><p className="metadata">Curator-checked background, separate from member opinions.</p>{catalogOf(data).filter((e) => !e.sample && (tab === "national" ? e.scope === "national" && e.kind === "news" : !!e.background)).slice(0, 3).map((e) => <button key={e.id} className="entity-row" onClick={() => navigate(entityRoute(e.id))}><FileText size={20}/><span><strong>{e.name}</strong><small>{e.sourceLabel} · Checked {e.checkedAt ?? e.background?.checkedAt}</small></span><ArrowUpRight size={16}/></button>)}</section>
      {openQuestions}
      <details className="commons-extras"><summary>Topics, groups & notifications</summary><CommonsIntro data={data} compose={compose} navigate={navigate} run={run} extrasOnly /><button className="text-button" onClick={() => navigate("guidelines")}><ShieldCheck size={14} /> Commons guidelines</button></details>
      <p className="metadata commons-footnote">
        Conversations within {data.community?.name}. Participation does not represent campus opinion, and campus
        membership does not verify student status.
      </p>
    </section>
  );
}
