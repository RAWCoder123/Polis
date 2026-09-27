"use client";
import { ArrowUpRight, FileText, MessageCircle, MessagesSquare, Radio, Bell, Check } from "lucide-react";
import { topicsFor, type CommonsTopic } from "@/lib/social/commons";
import type { Snapshot } from "@/lib/social/types";
import type { Navigate, Run } from "./social-post";
import type { ComposeOptions } from "./social-forms";
import { eventExpired, eventTime } from "@/lib/social/events";

export function CommonsIntro({ data, compose, navigate, run }: { data: Snapshot; compose: (o: ComposeOptions) => void; navigate: Navigate; run: Run }) {
  const topics = topicsFor(data.community?.id ?? "");
  return <section className="commons-intro">
    <p>Ask a question. Make room for another view. Follow what happens next.</p>
    <div className="commons-formats">
      <button onClick={() => compose({ kind: "question", subjectId: "community" })}><MessageCircle size={20} /><strong>Question</strong><span>Ask your community</span></button>
      <button onClick={() => compose({ kind: "debate", subjectId: "community" })}><MessagesSquare size={20} /><strong>Debate</strong><span>Explore different views</span></button>
      <button onClick={() => compose({ kind: "update", subjectId: "community" })}><Radio size={20} /><strong>Update</strong><span>Share a sourced development</span></button>
    </div>
    {topics.length > 0 && <div className="commons-topics" aria-label="Local topics">{topics.map(t => <button key={t.id} className="btn secondary" onClick={() => navigate("topic/" + t.id)}>{t.name}<ArrowUpRight size={15} /></button>)}</div>}
    {data.organizations?.map(o => <button key={o.id} className="text-button commons-organization-link" onClick={() => navigate(o.role ? "organization/" + o.id + "/discussion" : "join/" + data.community?.id)}>{o.name} · {o.role ? "Open space" : "Join with organization code"}<ArrowUpRight size={15}/></button>)}
    {!data.preferences.replies && <button className="text-button commons-notification-optin" onClick={() => void run({ action: "preferences", replies: true, reactions: !!data.preferences.reactions, issues: !!data.preferences.issues, events: !!data.preferences.events }).catch(() => {})}><Bell size={16} /> Enable in-app reply notifications</button>}
    <p className="metadata">Conversations within {data.community?.name}. Participation does not represent campus opinion. Campus membership does not verify student status.</p>
  </section>;
}

export function WhatChanged({ communityId, navigate }: { communityId: string; navigate: Navigate }) {
  const topics = topicsFor(communityId);
  if (!topics.length) return null;
  return <section className="commons-changed"><h2>What changed</h2><p className="metadata">Source notes and background · Manually checked, not a live news feed</p>{topics.map(t => <button key={t.id} onClick={() => navigate("topic/" + t.id)}><FileText size={19} /><span><strong>{t.documentTitle}</strong><small>{t.publisher} · Checked {t.checkedAt}</small></span><ArrowUpRight size={15} /></button>)}</section>;
}

export function CommonsTopicDetail({ topic, data, run, compose, navigate, children }: { topic: CommonsTopic; data: Snapshot; run: Run; compose: (o: ComposeOptions) => void; navigate: Navigate; children: React.ReactNode }) {
  const following = data.follows.find(f => f.issueId === topic.id);
  const updates = data.updates.filter(u => u.issueId === topic.id);
  const events = data.events.filter(e => e.issueId === topic.id && e.status === "published" && !eventExpired(e));
  return <section className="commons-topic-detail">
    <p className="social-section-label">{data.community?.name} · LOCAL TOPIC</p><h1>{topic.name}</h1><p>{topic.description}</p>
    <div className="commons-background"><FileText size={22} /><h2>Sourced background</h2><p>{topic.update}</p><a href={topic.source} target="_blank" rel="noopener noreferrer">{topic.documentTitle}<ArrowUpRight size={16}/></a><p className="metadata">{topic.publisher} · {topic.sourceDate ? "Published " + topic.sourceDate : "Publication date not supplied"} · Checked {topic.checkedAt}</p><p className="metadata">Check the original source for changes since this review. Member perspectives appear separately below.</p></div>
    <div className="commons-topic-actions"><button className="btn primary" onClick={() => compose({ kind: "question", subjectId: topic.id })}>Start a conversation</button><button className="btn secondary" onClick={() => void run({ action: "follow", issueId: topic.id, enabled: !following, notify: false }).catch(() => {})}>{following && <Check size={16}/>} {following ? "Following · Undo" : "Follow topic"}</button></div>
    {following && <label className="check-line"><input type="checkbox" checked={!!following.notify} onChange={async e => { const notify = e.target.checked; try { if (notify && !data.preferences.issues) await run({ action: "preferences", replies: !!data.preferences.replies, reactions: !!data.preferences.reactions, events: !!data.preferences.events, issues: true }); await run({ action: "follow", issueId: topic.id, enabled: true, notify }); } catch {} }} />Notify me in Polis when a curator adds an update</label>}
    {updates.length > 0 && <section><h2>Developments</h2>{updates.map(u => <div className="commons-background" key={u.id}><a href={u.sourceUrl} target="_blank" rel="noopener noreferrer">{u.title}<ArrowUpRight size={16}/></a><p className="metadata">{new Date(u.createdAt).toLocaleDateString()} · {u.sample ? "Sample" : "Curator source"}</p></div>)}</section>}
    <section className="commons-related-events"><h2>Related events and places</h2>{events.length ? events.map(e => <button className="post-subject" key={e.id} onClick={() => navigate("event/" + e.id)}><span><strong>{e.title}</strong><small>{eventTime(e)} · {e.venue}{e.sample ? " · Sample event" : ""}</small></span><ArrowUpRight size={16}/></button>) : <p className="metadata">No checked upcoming events linked to this topic yet.</p>}<button className="text-button" onClick={() => navigate("explore/events?mode=map")}>Explore the local map and event list<ArrowUpRight size={16}/></button></section>
    <h2>Community perspectives</h2>{children}
    {!data.posts.length && <p className="commons-empty">No conversations yet. Ask the first question or share your experience.</p>}
  </section>;
}
