"use client";

import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/social/types";
import type { Run } from "./social-post";

export function InvitationCodes({ data, run }: { data: Snapshot; run: Run }) {
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCheckedAt(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [code, setCode] = useState("");
  const [communityId, setCommunityId] = useState(data.community?.id ?? "ithaca");
  const [generatedCommunity, setGeneratedCommunity] = useState("");
  const [maxUses, setMaxUses] = useState("25");
  const [limited, setLimited] = useState(true);
  const [expiresDays, setExpiresDays] = useState<1 | 7 | 30>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  if (!data.admin) return null;
  return <section>
    <h2>Invite with a code</h2>
    <p>Anyone you share this code with can join with their own Polis account. No email list needed.</p>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const result = await run({ action: "invite.code", communityId, maxUses: limited ? Number(maxUses) : null, expiresDays });
        if (result.invitationCode) { setCode(result.invitationCode); setGeneratedCommunity(data.admin!.invitationCommunities.find(c => c.id === communityId)!.name); setCopied(false); }
      } catch (e) { setError(e instanceof Error ? e.message : "Could not generate a code. Try again."); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}>
      <label className="social-field">University / community
        <select value={communityId} onChange={e => setCommunityId(e.target.value)}>{data.admin.invitationCommunities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <label className="social-field">Code expires in
        <select value={expiresDays} onChange={e => setExpiresDays(Number(e.target.value) as 1 | 7 | 30)}>
          <option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option>
        </select>
      </label>
      <label className="check-line"><input type="checkbox" checked={limited} onChange={e => setLimited(e.target.checked)} />Limit the number of people</label>
      {limited ? <label className="social-field">Maximum uses<input type="number" min={1} max={10000} step={1} required value={maxUses} onChange={e => setMaxUses(e.target.value)} /></label> : <p className="metadata">No usage limit. The code still expires and can be revoked.</p>}
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Generate code"}</button>
      </fieldset>
    </form>
    {code && <div className="invite-result">
      <strong>{generatedCommunity}</strong>
      <label className="social-field">Your invitation code
        <input readOnly value={code} onFocus={e => e.target.select()} />
      </label>
      <button className="btn secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); }
        catch { setError("Select the code above and copy it."); }
      }}>{copied ? "Copied" : "Copy code"}</button>
      <p className="metadata">Share this code anywhere with the Polis site link. Testers select “Enter invite code,” confirm their community, then sign in. Copy it now; it is only shown here after generation.</p>
    </div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div aria-live="polite">{copied ? "Invitation code copied." : ""}</div>
    <h3>Created codes</h3>
    {data.admin.invitationCodes.length === 0 && <p>No codes yet.</p>}
    {data.admin.invitationCodes.map(item => {
      const state = item.revokedAt ? "Revoked" : Date.parse(item.expiresAt) <= checkedAt ? "Expired" : item.maxUses !== null && item.useCount >= item.maxUses ? "Fully used" : "Active";
      return <div key={item.id} className="invite-result">
        <strong>{data.admin!.invitationCommunities.find(c => c.id === item.communityId)?.name ?? item.communityId}</strong>
        <p>Created {new Date(item.createdAt).toLocaleString()} · {state}</p>
        <p className="metadata">{item.useCount}{item.maxUses === null ? " joined · No usage limit" : " of " + item.maxUses + " joined"} · Expires {new Date(item.expiresAt).toLocaleString()}</p>
        {state === "Active" && <button className="btn secondary small-btn" disabled={busy} onClick={async () => {
          setBusy(true); setError("");
          try { await run({ action: "invite.revoke", codeId: item.id }); setCode(""); }
          catch (e) { setError(e instanceof Error ? e.message : "Could not revoke this code. Try again."); }
          finally { setBusy(false); }
        }}>Revoke code</button>}
      </div>;
    })}
    <p className="metadata">Revoking stops new joins. People who already joined keep their membership.</p>
  </section>;
}
