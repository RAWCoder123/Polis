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
  const [maxUses, setMaxUses] = useState(25);
  const [expiresDays, setExpiresDays] = useState<1 | 7 | 30>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  if (!data.admin) return null;
  return <section>
    <h2>Invite with a code</h2>
    <p>Anyone you share this code with can join using their own ChatGPT account. No email list needed.</p>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const result = await run({ action: "invite.code", maxUses, expiresDays });
        if (result.invitationCode) { setCode(result.invitationCode); setCopied(false); }
      } catch (e) { setError(e instanceof Error ? e.message : "Could not generate a code. Try again."); }
      finally { setBusy(false); }
    }}>
      <label className="social-field">Number of people
        <select value={maxUses} onChange={e => setMaxUses(Number(e.target.value))}>
          <option value={1}>1 person · single use</option>
          <option value={25}>Up to 25 people</option>
          <option value={100}>Up to 100 people</option>
        </select>
      </label>
      <label className="social-field">Code expires in
        <select value={expiresDays} onChange={e => setExpiresDays(Number(e.target.value) as 1 | 7 | 30)}>
          <option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option>
        </select>
      </label>
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Generate invitation code"}</button>
    </form>
    {code && <div className="invite-result">
      <label className="social-field">Your invitation code
        <input readOnly value={code} onFocus={e => e.target.select()} />
      </label>
      <button className="btn secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); }
        catch { setError("Select the code above and copy it."); }
      }}>{copied ? "Copied" : "Copy code"}</button>
      <p className="metadata">Send the code with the Polis site link. They sign in, enter the code, and create a profile. Copy it now; it is only shown here after generation.</p>
    </div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div aria-live="polite">{copied ? "Invitation code copied." : ""}</div>
    <h3>Created codes</h3>
    {data.admin.invitationCodes.length === 0 && <p>No codes yet.</p>}
    {data.admin.invitationCodes.map(item => {
      const state = item.revokedAt ? "Revoked" : item.useCount >= item.maxUses ? "Fully used" : Date.parse(item.expiresAt) <= checkedAt ? "Expired" : "Active";
      return <div key={item.id} className="invite-result">
        <p>Created {new Date(item.createdAt).toLocaleString()} · {state}</p>
        <p className="metadata">{item.useCount} of {item.maxUses} joined · Expires {new Date(item.expiresAt).toLocaleString()}</p>
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
