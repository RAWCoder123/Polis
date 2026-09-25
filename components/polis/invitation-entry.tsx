"use client";
import { useEffect, useRef, useState } from "react";
import type { InvitationPreview, Snapshot } from "@/lib/social/types";
import { readResponse } from "@/lib/social/read-response";
import type { Run } from "./social-post";

export function InvitationEntry({ data, run, onJoined }: { data: Snapshot; run: Run; onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState(data.me?.username ? data.me.name : "");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    fetch("/api/polis?invitation=1", { cache: "no-store" }).then(async r => {
      const value = await readResponse<{ invitation: InvitationPreview | null; error?: string }>(r);
      if (!r.ok) throw new Error(value.error ?? "Could not check your invitation.");
      if (active) setInvitation(value.invitation);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const newProfile = !data.me?.username;
  async function validate() {
    const response = await fetch("/api/polis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "invite.preview", code } }) });
    const value = await readResponse<{ invitation: InvitationPreview; error?: string }>(response);
    if (!response.ok) throw new Error(value.error ?? "Could not check your invitation.");
    setInvitation(value.invitation);
    setCode("");
  }
  return <section className="onboarding-panel invitation-entry">
    <p className="social-section-label">OPTIONAL COMMUNITY INVITATION</p>
    <h2>{invitation ? "Your community is waiting." : "Enter invite code"}</h2>
    {loading ? <p role="status">Checking your invitation…</p> : !invitation ? <>
      <p>Use a code from your university or community organizer. This joins that community; a code isn’t required to create your Polis account.</p>
      <form onSubmit={async e => {
        e.preventDefault(); if (pending.current) return;
        pending.current = true; setBusy(true); setError("");
        try { await validate(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <label className="social-field">Invite code<input required maxLength={200} value={code} onChange={e => setCode(e.target.value)} placeholder="POLIS-XXXX-XXXX-XXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" /></label>
        <button className="btn primary full" disabled={busy}>{busy ? "Checking…" : "Check code"}</button>
      </form>
    </> : <>
      <div className="invite-result" aria-live="polite">
        <span className="metadata">University / community</span>
        <h3>{invitation.community.name}</h3>
        <p>{invitation.alreadyJoined ? "You’ve already joined this community. Continuing won’t use another invitation." : "This code grants ordinary pilot membership. It does not verify university enrollment."}</p>
        <p className="metadata">Expires {new Date(invitation.expiresAt).toLocaleString()}. Availability is checked again when you join.</p>
      </div>
      {data.status === "signed_out" ? <>
        <a className="btn primary full" href="/signin-with-chatgpt?return_to=%2F%23join" target="_top">Confirm community & sign in</a>
        <p className="metadata">Continue with the existing ChatGPT sign-in or signup process. Any required account verification happens there. Your invitation is kept for up to one hour.</p>
      </> : <form onSubmit={async e => {
        e.preventDefault(); if (pending.current) return;
        pending.current = true; setBusy(true); setError("");
        try {
          await run({ action: "invite.redeem", invite: "", confirmedCommunityId: invitation.community.id, ...(newProfile ? { name, username } : {}) });
          await fetch("/api/polis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "invite.clear" } }) }).catch(() => {});
          onJoined();
        } catch (e) { setError(e instanceof Error ? e.message : "Could not join. Your invitation is still here."); }
        finally { pending.current = false; setBusy(false); }
      }}>
        {newProfile && <>
          <label className="social-field">Your name<input required maxLength={50} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
          <label className="social-field">Username<input required pattern="[a-z0-9_]{3,24}" title="3–24 lowercase letters, numbers, or underscores" maxLength={24} value={username} onChange={e => setUsername(e.target.value.toLowerCase())} autoComplete="username" /></label>
        </>}
        <button className="btn primary full" disabled={busy}>{busy ? "Joining…" : invitation.alreadyJoined ? "Continue to community" : "Join " + invitation.community.name}</button>
      </form>}
      <button className="text-button" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try {
          const response = await fetch("/api/polis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "invite.clear" } }) });
          if (!response.ok) throw new Error("Could not clear this invitation. Please retry.");
          setInvitation(null);
        } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); }
        finally { setBusy(false); }
      }}>Use another code</button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <a className="text-button" href={data.status === "ready" ? "#home" : "#signup"}>{data.status === "ready" ? "Back to Polis" : "Continue without a code"}</a>
  </section>;
}
