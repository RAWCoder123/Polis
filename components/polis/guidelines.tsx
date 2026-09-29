"use client";
import "./civic.css";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Navigate } from "./social-post";

// Short and specific on purpose. Enforcement is the existing report, mute,
// block and owner review flow; nothing here is automated scoring.
export function CommunityGuidelines({ navigate }: { navigate: Navigate }) {
  return (
    <article className="guidelines">
      <button className="text-button" onClick={() => navigate("commons")}>
        <ArrowLeft size={15} /> The Commons
      </button>
      <p className="social-section-label">
        <ShieldCheck size={14} aria-hidden="true" /> COMMUNITY GUIDELINES
      </p>
      <h1>A town square works when people can disagree and come back tomorrow.</h1>
      <ol>
        <li>
          <strong>Keep it local and concrete.</strong> Tie posts to a place, issue, decision, event or organization in your community.
        </li>
        <li>
          <strong>Argue with ideas, not people.</strong> No insults, harassment, threats, slurs or pile-ons. Criticize public decisions and offices freely; leave private lives alone.
        </li>
        <li>
          <strong>Show your sources.</strong> Link where a factual claim comes from. Say when something is your experience or opinion. “Want to understand more” is a fair reaction, not an attack.
        </li>
        <li>
          <strong>Be yourself.</strong> Don’t impersonate students, officials or organizations, and don’t post someone else’s private information.
        </li>
        <li>
          <strong>Choose your audience.</strong> Friends is the default outside The Commons. Commons posts are visible to members of this community only, not the public web.
        </li>
        <li>
          <strong>Use the tools.</strong> Report a post or reply from its menu. Mute or block anyone at any time. Community owners review reports and can remove content.
        </li>
      </ol>
      <p className="metadata">
        Polis does not rank by outrage. Trending counts how many different people take part in a conversation, not how many reactions it collects.
        Starter questions and briefs marked Sample are written by Polis to open a discussion; they are not reporting or pending decisions.{" "}
        <a href="/privacy">How Polis handles your information</a>.
      </p>
    </article>
  );
}
