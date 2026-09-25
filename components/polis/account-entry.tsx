"use client";

import { useRef, useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import type { Run } from "./social-post";

export function SignInChoice({ returnTo }: { returnTo: string }) {
  return <section className="onboarding-panel account-entry">
    <p className="social-section-label">WELCOME TO POLIS</p>
    <h2>Your perspective belongs here.</h2>
    <p>Create an account or log in. You don’t need an invitation code to get started.</p>
    <a className="btn primary full" href={"/signin-with-chatgpt?return_to=" + encodeURIComponent(returnTo)} target="_top">Continue with OpenAI <ArrowRight size={17} /></a>
    <p className="metadata">Sign-in is handled by OpenAI. Choose email, Google (including Gmail), Apple, or Microsoft on the next screen. You can also use your existing ChatGPT account. An OpenAI account is required.</p>
    <div className="account-optional"><strong>Joining a university or organization?</strong><p>Use a community code when you have one. It’s separate from your account.</p><a className="text-button" href="#join">Enter an optional invite code <ArrowRight size={15} /></a></div>
  </section>;
}

export function AccountSetup({ name, run, onCreated }: { name: string; run: Run; onCreated: () => void }) {
  const [displayName, setName] = useState(name === "Seedy" ? "" : name);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  return <section className="onboarding-panel account-entry">
    <p className="social-section-label"><UserRound size={16} /> SIGNED IN · ONE LAST STEP</p>
    <h2>Make yourself at home.</h2>
    <p>Choose your name and username to create your Polis profile. No invitation required.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (pending.current) return;
      pending.current = true; setBusy(true); setError("");
      try { await run({ action: "account.create", name: displayName, username }); onCreated(); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not create your profile. Your details are still here."); }
      finally { pending.current = false; setBusy(false); }
    }}>
      <label className="social-field">Your name<input required autoComplete="name" maxLength={50} value={displayName} onChange={e => setName(e.target.value)} /></label>
      <label className="social-field">Username<input required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} pattern="[a-z0-9_]{3,24}" title="3–24 lowercase letters, numbers, or underscores" maxLength={24} value={username} onChange={e => setUsername(e.target.value.toLowerCase())} /></label>
      <p className="metadata">You’ll start in Polis commons, open to registered members. University and organization communities remain separate. Posts default to Friends; you choose when to share more widely.</p>
      <button className="btn primary full" disabled={busy}>{busy ? "Creating your profile…" : "Create my Polis account"}<ArrowRight size={17} /></button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
    <div className="account-optional"><a className="text-button" href="#join">Have a community code? Use it here <ArrowRight size={15} /></a><p>You can also join a community later.</p></div>
  </section>;
}
