"use client";
import { ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import type { CivicEntity, Explainer } from "@/lib/social/types";
import { explained } from "@/lib/social/civic/explainers";
import { entityRoute } from "./civic-cards";
import type { Navigate } from "./social-post";

// About 200 words a minute, never under one.
export function readMinutes(x: Explainer) {
  const text = [x.inShort, ...x.changes, ...x.affects, x.stage, x.next?.what, x.next?.when, x.next?.how].join(" ");
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}
const dateLabel = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// A law, proposal or document in plain language: what it does, who it
// affects, where it stands and how to take part, with the originals linked.
export function ExplainerCard({ entity }: { entity: CivicEntity }) {
  const x = entity.explainer!;
  return (
    <section className="explainer" aria-labelledby={"explainer-" + entity.id}>
      <p className="explainer-kicker">
        <BookOpen size={15} aria-hidden="true" /> Explained{entity.sample ? " · Sample" : ""} · {readMinutes(x)} min read
      </p>
      <h2 id={"explainer-" + entity.id} className="sr-only">
        In short
      </h2>
      <p className="explainer-short">{x.inShort}</p>
      <div className="explainer-grid">
        <section>
          <h3>{x.changesLabel ?? "What would change"}</h3>
          <ul>
            {x.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Who it affects</h3>
          <ul>
            {x.affects.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      </div>
      <section className="explainer-stage">
        <h3>Where it stands</h3>
        <p>{x.stage}</p>
        {x.next && (
          <div className="explainer-next">
            <strong>What happens next</strong>
            <p>{x.next.what}</p>
            {x.next.when && <p>{x.next.when}</p>}
            {x.next.how && (
              <p>
                <b>How to weigh in:</b> {x.next.how}
              </p>
            )}
            {x.next.url && (
              <a href={x.next.url} target="_blank" rel="noopener noreferrer">
                {x.next.urlLabel ?? "Details"} <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        )}
      </section>
      {x.terms && x.terms.length > 0 && (
        <details className="explainer-terms">
          <summary>Words to know ({x.terms.length})</summary>
          <dl>
            {x.terms.map((t) => (
              <div key={t.term}>
                <dt>{t.term}</dt>
                <dd>{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <footer className="explainer-sources">
        {x.sources.length > 0 && (
          <p>
            {x.sources.length === 1 ? "Source: " : "Sources: "}
            {x.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>{" "}
                ({s.publisher}
                {s.date ? ", " + dateLabel(s.date) : ""})
              </span>
            ))}
          </p>
        )}
        <p>
          Explained by Polis in plain language, checked {dateLabel(x.checkedAt)}. Read the original for full detail; things may have
          changed since.
          {entity.sample ? " This proposal is an illustration, not a real pending decision." : ""}
        </p>
      </footer>
    </section>
  );
}

// One explainer a day on Home, with the rest a tap away.
export function ExplainedToday({ entity, catalog, navigate }: { entity: CivicEntity; catalog: CivicEntity[]; navigate: Navigate }) {
  const x = entity.explainer!;
  const more = explained(catalog)
    .filter((e) => e.id !== entity.id && !e.sample)
    .slice(0, 2);
  return (
    <section className="explained-today" aria-label="Explained today">
      <p className="explainer-kicker">
        <BookOpen size={15} aria-hidden="true" /> Explained today{entity.sample ? " · Sample" : ""} · {readMinutes(x)} min read
      </p>
      <button className="explained-today-main" onClick={() => navigate(entityRoute(entity.id))}>
        <strong>{x.title ?? entity.name}</strong>
        <span>{x.inShort}</span>
        <em>
          Read the explainer <ArrowRight size={15} aria-hidden="true" />
        </em>
      </button>
      {more.length > 0 && (
        <p className="explained-more">
          Also explained:{" "}
          {more.map((e, i) => (
            <span key={e.id}>
              {i > 0 && " · "}
              <button className="text-button inline" onClick={() => navigate(entityRoute(e.id))}>
                {e.explainer!.title ?? e.name}
              </button>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
