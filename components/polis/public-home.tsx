"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { PolisShowcase } from "./polis-showcase";

const SocialApp = dynamic(() => import("./social-app"), {
  loading: () => <p className="showcase-app-loading" role="status">Opening your community…</p>,
});
const showcaseAnchors = new Set(["", "#why-polis", "#how-it-works", "#community", "#pilot", "#showcase-main"]);

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

// Preserve the app's existing hash deep links, including invitations and replies.
export function PublicHome() {
  const destination = useSyncExternalStore(subscribe, () => location.hash, () => "");
  const hasLegacyInvite = useSyncExternalStore(subscribe, () => new URLSearchParams(location.search).has("invite"), () => false);
  return showcaseAnchors.has(destination) && !hasLegacyInvite ? <PolisShowcase /> : <SocialApp />;
}
