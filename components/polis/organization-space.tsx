"use client";
import { useState } from "react";
import { Copy, Users } from "lucide-react";
import type { Snapshot } from "@/lib/social/types";
import type { Run, Navigate } from "./social-post";
import type { ComposeOptions } from "./social-forms";
import { toast } from "sonner";

export function OrganizationSpace({ id, channel, data, run, navigate, compose, children }: { id: string; channel: string; data: Snapshot; run: Run; navigate: Navigate; compose: (o: ComposeOptions) => void; children: React.ReactNode }) {
  const org = data.organizations?.find(o => o.id === id);
  const [code, setCode] = useState("");
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [limit, setLimit] = useState("10");
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState("");
  if (!org?.role) return <section className="commons-empty"><h2>Join this organization with its code.</h2><p>You’ll need membership in the matching campus first.</p><button className="btn primary" onClick={() => navigate("join/" + data.community?.id)}>Enter a code</button></section>;
  const active = ["announcements", "discussion", "plans"].includes(channel) ? channel : "discussion";
  return <section className="organization-space">
    <p className="social-section-label"><Users size={16}/> {data.community?.name} · PRIVATE ORGANIZATION</p><h1>{org.name}</h1><p>{org.description}</p><p className="metadata">Only organization members with the post’s audience can see its conversation. Invitation codes grant member access, never organizer powers.</p>
    <div className="social-tabs" role="tablist" aria-label="Organization views">{[["announcements", "Announcements"], ["discussion", "Discussion"], ["plans", "Events / Plans"]].map(([key, label]) => <button key={key} role="tab" className={active === key ? "active" : ""} aria-selected={active === key} onClick={() => navigate("organization/" + id + "/" + key)}>{label}</button>)}</div>
    {(active !== "announcements" || org.role === "organizer") && <button className="btn primary" onClick={() => compose({ kind: "question", subjectId: "community", organizationId: id, organizationChannel: active as "announcements" | "discussion" | "plans" })}>{active === "announcements" ? "Write an announcement" : active === "plans" ? "Discuss a plan" : "Start a discussion"}</button>}
    {active === "plans" && <button className="text-button" onClick={() => navigate("explore/events")}>Find campus events to share</button>}
    {children}
    {!data.posts.length && <p className="commons-empty">Nothing here yet. This space is ready for its members.</p>}
    <details><summary>Members ({data.organizationMembers?.length ?? 0} visible)</summary>{data.organizationMembers?.map(p => <div className="organization-member" key={p.id}><span>{p.name} · {p.role}</span>{data.me?.role === "owner" && p.id !== data.me.id && <button className="text-button" onClick={() => void run({ action: "organization.member", organizationId: id, userId: p.id, role: "remove" }).catch(() => {})}>Remove access</button>}</div>)}</details>
    {data.me?.role === "owner" && <form className="organization-manage" onSubmit={async e => { e.preventDefault(); try { await run({ action: "organization.member", organizationId: id, userId: person, role: "organizer" }); setPerson(""); } catch {} }}><label className="social-field">Appoint an organizer<select required value={person} onChange={e => setPerson(e.target.value)}><option value="">Choose a campus member</option>{data.people.filter(p => !p.blocked).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn secondary">Grant organizer access</button></form>}
    {org.role === "organizer" && <details className="organization-manage"><summary>Organization invitation codes</summary><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { const r = await run({ action: "invite.code", organizationId: id, expiresDays: days, maxUses: limit ? Number(limit) : null }); setCode(r.invitationCode ?? ""); } catch { /* The shared error banner preserves the form for retry. */ } finally { setBusy(false); } }}>
      <label className="social-field">Code expires in<select value={days} onChange={e => setDays(Number(e.target.value) as 1 | 7 | 30)}><option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option></select></label><label className="social-field">Maximum uses · optional<input type="number" min={1} max={10000} value={limit} onChange={e => setLimit(e.target.value)}/></label><button className="btn primary" disabled={busy}>Generate organization code</button></form>
      {code && <div className="organization-code"><label className="social-field">Organization code<input readOnly value={code}/></label><button className="btn secondary" onClick={() => void navigator.clipboard.writeText(code).then(() => toast.success("Code copied")).catch(() => toast.error("Select the code to copy it."))}><Copy size={16}/>Copy code</button></div>}
      {data.organizationCodes?.map(c => <div className="organization-code-row" key={c.id}><span>{c.useCount} / {c.maxUses ?? "unlimited"} uses · Expires {new Date(c.expiresAt).toLocaleDateString()}</span><button className="text-button" disabled={!!c.revokedAt} onClick={() => void run({ action: "invite.revoke", codeId: c.id }).catch(() => {})}>{c.revokedAt ? "Revoked" : "Revoke"}</button></div>)}
    </details>}
  </section>;
}
