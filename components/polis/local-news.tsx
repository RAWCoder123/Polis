"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, HeartHandshake, MessagesSquare, Newspaper, ShieldAlert } from "lucide-react";
import type { CivicEntity, Snapshot } from "@/lib/social/types";
import { newsCategories, sensitiveSupport, type NewsCategory, type RankedStory } from "@/lib/social/local-news";
import { categoryColors } from "@/lib/colors";
import { toneVars } from "@/lib/colors";
import { inCatalog, catalogOf } from "@/lib/social/civic";
import { entityRoute } from "./civic-cards";
import type { Navigate } from "./social-post";

const ago = (iso: string) => {
  const h = Math.max(0, (Date.now() - Date.parse(iso)) / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return Math.round(h) + "h ago";
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : d + " days ago";
};
const label = (s: RankedStory) => (s.opinion ? "Opinion" : newsCategories[s.category].label);

// Refreshes a community's news in the background when it is more than three
// hours old, once per community per visit; the server also enforces the limit.
export function useNewsRefresh(data: Snapshot, refresh: () => Promise<unknown> | void) {
  const tried = useRef(new Set<string>());
  const id = data.community?.id;
  const updated = data.newsUpdatedAt;
  useEffect(() => {
    const stale = !updated || Date.now() - Date.parse(updated) > 3 * 3600000;
    if (data.status !== "ready" || !id || id === "polis" || !stale || tried.current.has(id)) return;
    tried.current.add(id);
    void fetch("/api/polis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), communityId: id, data: { action: "news.import" } }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ imported?: number }>) : null))
      .then((r) => {
        if (r?.imported) void refresh();
      })
      .catch(() => {});
  }, [data.status, id, updated, refresh]);
}

export function NewsCard({
  story,
  entity,
  navigate,
  discuss,
  variant = "list",
}: {
  story: RankedStory;
  entity?: CivicEntity;
  navigate: Navigate;
  discuss: (e: CivicEntity) => void;
  variant?: "list" | "tile";
}) {
  const color = categoryColors[story.opinion ? "other" : story.category];
  return (
    <article className={"news-card " + variant} style={toneVars(color) as React.CSSProperties}>
      <button className="news-card-main" onClick={() => navigate(entityRoute(story.id))}>
        <span className="news-band">
          <span className="news-chip">{label(story)}</span>
          {story.sensitive && (
            <span className="news-chip sensitive">
              <ShieldAlert size={12} aria-hidden="true" /> Sensitive
            </span>
          )}
          {variant === "list" && <span className="news-when">{ago(story.publishedAt)}</span>}
        </span>
        <strong>{story.title}</strong>
        <small>
          {story.source}
          {story.outlets > 1 ? " · " + story.outlets + " outlets" : ""}
          {variant === "tile" ? " · " + ago(story.publishedAt) : ""}
        </small>
      </button>
      <footer>
        <span className="news-why">{story.reasons.filter((r) => !/^About |^Near /.test(r) && r !== label(story)).join(" · ") || story.reasons[0]}</span>
        {entity && (
          <button className="text-button" onClick={() => discuss(entity)}>
            <MessagesSquare size={15} /> {story.discussing ? "Join the forum" : "Start a forum"}
          </button>
        )}
      </footer>
    </article>
  );
}

// The full list, with a filter for each kind of news present.
export function LocalNewsList({
  data,
  navigate,
  discuss,
}: {
  data: Snapshot;
  navigate: Navigate;
  discuss: (e: CivicEntity) => void;
}) {
  const [filter, setFilter] = useState<NewsCategory | "all">("all");
  const stories = data.news ?? [];
  const catalog = catalogOf(data);
  const present = [...new Set(stories.map((s) => (s.opinion ? null : s.category)).filter((c): c is NewsCategory => !!c))];
  const shown = stories.filter((s) => filter === "all" || (!s.opinion && s.category === filter));
  return (
    <section className="local-news" aria-label="Local news">
      <p className="local-news-intro">
        What {data.community?.campus?.shortName ?? data.community?.name ?? "your community"} is reading and talking about: local
        stories first, ranked by how much they touch student life, how widely they are reported and how many people here are
        discussing them. Start a forum on any story.
      </p>
      {present.length > 1 && (
        <div className="news-filters" role="group" aria-label="Kinds of news">
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          {present.map((c) => (
            <button key={c} aria-pressed={filter === c} style={toneVars(categoryColors[c]) as React.CSSProperties} onClick={() => setFilter(c)}>
              <i aria-hidden="true" /> {newsCategories[c].label}
            </button>
          ))}
        </div>
      )}
      <div className="news-list">
        {shown.map((s) => (
          <NewsCard key={s.id} story={s} entity={inCatalog(catalog, s.id)} navigate={navigate} discuss={discuss} />
        ))}
      </div>
      {!stories.length && (
        <p className="social-empty">
          <Newspaper size={22} aria-hidden="true" />
          <br />
          Local news appears here after the first refresh from {data.community?.name ?? "this community"}&apos;s outlets. Check back
          in a moment.
        </p>
      )}
      <p className="metadata">
        Headlines and links from local outlets and the GDELT news index
        {data.newsUpdatedAt ? ", updated " + ago(data.newsUpdatedAt).toLowerCase() : ""}. Polis links to the original reporting and
        does not rewrite it.
      </p>
    </section>
  );
}

// At the top of a story's page: its colors, the care it needs, who reported it.
export function NewsStoryHeader({ entity }: { entity: CivicEntity }) {
  const s = entity.story!;
  const color = categoryColors[s.opinion ? "other" : s.category];
  const care = s.sensitive ? sensitiveSupport[s.sensitive] : null;
  return (
    <>
      <section className="news-story-banner" style={toneVars(color) as React.CSSProperties}>
        <span className="news-chip">{label(s)}</span>
        <h1>{s.title}</h1>
        <p>
          {s.source} · {ago(s.publishedAt)}
          {s.outlets > 1 ? " · reported by " + s.outlets + " outlets" : ""}
        </p>
        <a className="btn news-read" href={s.url} target="_blank" rel="noopener noreferrer">
          Read at {s.source} <ArrowUpRight size={15} />
        </a>
      </section>
      {care && (
        <aside className="news-care" role="note">
          <HeartHandshake size={20} aria-hidden="true" />
          <div>
            <strong>{care.note}</strong>
            <p>
              {care.support}{" "}
              <a href={care.url} target="_blank" rel="noopener noreferrer">
                Get support <ArrowUpRight size={12} />
              </a>
            </p>
            <p>In this forum, please don&apos;t name or speculate about people involved. Report posts that do.</p>
          </div>
        </aside>
      )}
      {s.reasons.length > 0 && <p className="news-reasons">Why it&apos;s here: {s.reasons.join(" · ")}</p>}
      {s.articles.length > 1 && (
        <section className="news-coverage">
          <h2>Coverage</h2>
          <ul>
            {s.articles.slice(0, 8).map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.title}
                </a>{" "}
                <small>
                  {a.source} · {ago(a.publishedAt)}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export const topStories = (data: Snapshot, n: number) => (data.news ?? []).slice(0, n);
export const storyEntity = (data: Snapshot, id: string) => inCatalog(catalogOf(data), id);
