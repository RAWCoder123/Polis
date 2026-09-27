"use client";
import "./civic.css";
import { ArrowRight, ArrowUpRight, Bell, Bookmark, GraduationCap, LocateFixed, MapPin, MessageCircle, Users } from "lucide-react";
import type { CivicEntity, CommunityEvent, Post, Snapshot } from "@/lib/social/types";
import { catalogOf, inCatalog } from "@/lib/social/civic";
import { discoverEvents, eventDay, eventTime, eventCategories } from "@/lib/social/events";
import { useDeviceLocation } from "@/lib/social/use-device-location";
import { localeOf } from "@/lib/social/communities";
import { subjectTitle } from "@/lib/social/catalog";
import { CivicMap, mapPins } from "./civic-map";
import { EntityRow, EntityVisual, EventVisual, entityRoute } from "./civic-cards";
import { QuestionCard, rankedQuestions } from "./commons";
import type { Navigate, Run } from "./social-post";

const dayLabel = (e: CommunityEvent) =>
  new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, month: "short", day: "numeric" }).format(new Date(e.startsAt));

function DiscussionRow({ post, data, navigate }: { post: Post; data: Snapshot; navigate: Navigate }) {
  const attachment = JSON.parse(post.attachmentJson || "{}");
  const subject = inCatalog(catalogOf(data), post.subjectId);
  const title: string = post.title || post.text.split("\n")[0];
  return (
    <button className="discussion-row" onClick={() => navigate("post/" + post.id + "?community=" + post.communityId)}>
      <span className="entity-kind">
        {subject ? subject.name : post.subjectId === "community" ? "General conversation" : attachment.eventTitle || subjectTitle(post.subjectId)}
      </span>
      <strong>{title.length > 140 ? title.slice(0, 137) + "…" : title}</strong>
      <small>
        {post.name} · <Users size={12} aria-hidden="true" /> {post.participantCount}{" "}
        {post.participantCount === 1 ? "person" : "people"} · <MessageCircle size={12} aria-hidden="true" /> {post.replyCount}{" "}
        {post.replyCount === 1 ? "reply" : "replies"}
      </small>
    </button>
  );
}

// Real signals only: unread activity for you, what you follow, who is here.
function Pulse({ data, navigate }: { data: Snapshot; navigate: Navigate }) {
  const unreadReplies = data.notifications.filter((n) => !n.readAt && n.kind === "reply").length;
  const unread = data.notifications.filter((n) => !n.readAt).length;
  const following = data.follows.length;
  const members = data.people.length + 1;
  return (
    <div className="home-pulse" aria-label="Your community at a glance">
      <button onClick={() => navigate(unread ? "notifications" : "commons/following")}>
        <Bell size={16} aria-hidden="true" />
        <span>
          <strong>{unreadReplies ? unreadReplies + (unreadReplies === 1 ? " new reply" : " new replies") : unread ? unread + " new updates" : "You’re caught up"}</strong>
          <small>{unreadReplies ? "in conversations you’re part of" : unread ? "since your last visit" : "Replies to you will appear here"}</small>
        </span>
      </button>
      <button onClick={() => navigate(following ? "commons/following" : "explore")}>
        <Bookmark size={16} aria-hidden="true" />
        <span>
          <strong>{following ? "Following " + following + (following === 1 ? " topic or place" : " topics and places") : "Follow what you care about"}</strong>
          <small>{following ? "See their latest discussions" : "Pick a topic, office or place on the map"}</small>
        </span>
      </button>
      <button onClick={() => navigate("friends")}>
        <Users size={16} aria-hidden="true" />
        <span>
          <strong>
            {members} {members === 1 ? "member" : "members"} here
          </strong>
          <small>Find friends in {data.community?.name}</small>
        </span>
      </button>
    </div>
  );
}

export function HomeDashboard({
  data,
  run,
  navigate,
  discuss,
  discussEvent,
  children,
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  discuss: (e: CivicEntity) => void;
  discussEvent: (e: CommunityEvent) => void;
  children?: React.ReactNode;
}) {
  const community = data.community;
  const campus = community?.campus;
  const locale = localeOf(community);
  const location = useDeviceLocation();
  const entities = catalogOf(data);
  const now = new Date();
  const today = eventDay(now.toISOString(), locale?.timezone);
  const upcoming = discoverEvents(data.events, data.eventPreferences).map((r) => r.event);
  const todayEvents = upcoming.filter((e) => eventDay(e.startsAt, e.timezone) === today);
  const meetings = upcoming
    .filter((e) => e.category === "civic_meetings" && Date.parse(e.startsAt) - +now < 8 * 86400000)
    .filter((e) => !todayEvents.includes(e));
  const briefs = entities
    .filter((e) => e.kind === "news" && e.news)
    .sort((a, b) => b.news!.publishedAt.localeCompare(a.news!.publishedAt))
    .slice(0, 3);
  const people = [
    ...entities.filter((e) => e.kind === "official" && e.scope === "campus"),
    ...entities.filter((e) => e.kind === "official" && e.scope === "local"),
    ...entities.filter((e) => e.kind === "institution"),
  ].slice(0, 5);
  const discussions = data.posts.filter((p) => p.audience !== "only_me").slice(0, 3);
  const questions = rankedQuestions(data).slice(0, discussions.length >= 2 ? 1 : 2);
  const pinCount = mapPins(data).length;
  const dateLine = new Intl.DateTimeFormat("en-US", {
    timeZone: locale?.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  if (!locale)
    return (
      <section className="home-dash">
        <header className="home-hero">
          <p className="social-section-label">{(community?.name ?? "POLIS").toUpperCase()} · {dateLine.toUpperCase()}</p>
          <h1>Your commons, wherever you are.</h1>
          <p className="open-welcome">
            <strong>Welcome to {community?.name ?? "Polis"}.</strong> Start a conversation or find people. Posts you share
            with the community here are visible to other registered members.
          </p>
          <p>
            Polis works best close to home. Find the commons for your town or campus, or start one: you’ll get a local map
            of public places, your local offices, starter questions and a place to talk with neighbors.
          </p>
          <div className="form-actions">
            <button className="btn primary" onClick={() => navigate("communities")}>
              <MapPin size={16} /> Find your community
            </button>
            <button className="btn secondary" onClick={() => navigate("commons")}>
              Open The Commons <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => navigate("join")}>
              Have a community code?
            </button>
          </div>
        </header>
        {children}
      </section>
    );

  return (
    <section className="home-dash">
      <header className="home-hero">
        <p className="social-section-label">
          {campus ? <GraduationCap size={14} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}{" "}
          {[campus?.university, [locale.city, locale.region].filter(Boolean).join(", ")].filter(Boolean).join(" · ").toUpperCase()} · {dateLine.toUpperCase()}
        </p>
        <h1>What’s happening around {locale.shortName} today.</h1>
        <Pulse data={data} navigate={navigate} />
      </header>
      {children}
      <div className="home-grid">
        <div className="home-main">
          <section className="home-section">
            <div className="section-row">
              <h2>Happening near you</h2>
              <button className="text-button" onClick={() => navigate("explore")}>
                Open the map <ArrowUpRight size={15} />
              </button>
            </div>
            <CivicMap
              data={data}
              run={run}
              navigate={navigate}
              discuss={discuss}
              discussEvent={discussEvent}
              variant="preview"
              selected=""
              onSelect={(id) => {
                if (id) navigate("explore?selected=" + encodeURIComponent(id));
              }}
            />
            <p className="map-footnote">
              {pinCount} places, offices and events around {locale.shortName}.{" "}
              {location.status === "granted" ? (
                "Using your location on this device only."
              ) : (
                <button className="text-button inline" onClick={location.locate}>
                  <LocateFixed size={14} /> Use my location
                </button>
              )}
              {(location.status === "denied" || location.status === "unavailable") &&
                " Location is off, so Polis uses the center of " + locale.shortName + "."}
            </p>
          </section>

          <section className="home-section">
            <div className="section-row">
              <h2>The Commons</h2>
              <button className="text-button" onClick={() => navigate("commons")}>
                All discussions <ArrowUpRight size={15} />
              </button>
            </div>
            {discussions.map((p) => (
              <DiscussionRow key={p.id} post={p} data={data} navigate={navigate} />
            ))}
            <div className="question-grid">
              {questions.map(({ e }) => (
                <QuestionCard key={e.id} entity={e} data={data} navigate={navigate} />
              ))}
            </div>
          </section>

          <section className="home-section">
            <h2>Today and this week</h2>
            {!todayEvents.length && !meetings.length && !briefs.length && (
              <p className="metadata today-empty">
                Nothing is listed for this week yet. Curators add local meetings and events, and anyone can suggest one.{" "}
                <button className="text-button inline" onClick={() => navigate("explore/events")}>
                  Suggest or browse events
                </button>
              </p>
            )}
            <ul className="today-list">
              {todayEvents.map((e) => (
                <li key={e.id}>
                  <button onClick={() => navigate("event/" + e.id)}>
                    <EventVisual category={e.category} size="sm" />
                    <span>
                      <small>{eventCategories[e.category]} · Today{e.sample ? " · Sample" : ""}</small>
                      <strong>{e.title}</strong>
                      <em>{eventTime(e).split(" · ").slice(1).join(" · ")}</em>
                    </span>
                  </button>
                </li>
              ))}
              {meetings.slice(0, 2).map((e) => (
                <li key={e.id}>
                  <button onClick={() => navigate("event/" + e.id)}>
                    <EventVisual category={e.category} size="sm" />
                    <span>
                      <small>Public meeting · {dayLabel(e)}{e.sample ? " · Sample" : ""}</small>
                      <strong>{e.title}</strong>
                      <em>{e.venue}</em>
                    </span>
                  </button>
                </li>
              ))}
              {briefs.map((b) => (
                <li key={b.id}>
                  <button onClick={() => navigate(entityRoute(b.id))}>
                    <EntityVisual entity={b} size="sm" />
                    <span>
                      <small>
                        {b.news!.source} · {new Date(b.news!.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </small>
                      <strong>{b.name}</strong>
                      <em>{b.summary}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="home-side">
          <section className="home-section">
            <div className="section-row">
              <h2>Upcoming</h2>
              <button className="text-button" onClick={() => navigate("explore/events")}>
                All events <ArrowUpRight size={15} />
              </button>
            </div>
            {upcoming.slice(0, 4).map((e) => (
              <button key={e.id} className="upcoming-row" onClick={() => navigate("event/" + e.id)}>
                <span className="date-chip">
                  <strong>{dayLabel(e).split(" ")[1]}</strong>
                  <small>{dayLabel(e).split(" ")[0].toUpperCase()}</small>
                </span>
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {eventCategories[e.category]} · {e.venue}
                    {e.sample ? " · Sample" : ""}
                  </small>
                </span>
              </button>
            ))}
            {!upcoming.length && (
              <p className="metadata">
                {campus ? "Upcoming campus and community events" : "Upcoming community events"} appear here when curators publish
                them.
              </p>
            )}
          </section>
          <section className="home-section">
            <div className="section-row">
              <h2>People & institutions</h2>
              <button className="text-button" onClick={() => navigate("explore?layer=people")}>
                Map <ArrowUpRight size={15} />
              </button>
            </div>
            {people.map((e) => (
              <EntityRow key={e.id} entity={e} navigate={navigate} meta={e.office?.jurisdiction ?? e.subtitle} />
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
