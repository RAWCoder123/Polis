import type { Identity } from "../social/service.ts";
import { SIGN_IN_PATH, SIGN_OUT_PATH, safeReturnPath } from "./paths.ts";

// Development-only sign-in with visibly synthetic identities, so the app and
// every browser suite run on this computer without a sign-in provider. Only
// `next dev` on a loopback address ever reaches this code (see mode.ts).

export const LOCAL_AUTH_COOKIE = "__polis_local_auth";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

type LocalAccount = { id: string; email: string; name: string };
// Seedy is the local pilot owner unless POLIS_OWNER_EMAIL names someone else.
export const LOCAL_OWNER_EMAIL = "seedy@sites.test";
const owner: LocalAccount = { id: "local_seedy", email: LOCAL_OWNER_EMAIL, name: "Seedy" };
const fixed = ["ithaca_a", "ithaca_b", "ithaca_c", "uf_a", "uf_b", "uf_c", "motion_a", "motion_b"];
const testIdentities: Record<string, LocalAccount> = {
  ...Object.fromEntries(fixed.map((key) => [key, { id: "local_" + key, email: key + "@sites.test", name: "Test " + key }])),
  // Synthetic local parts at campus domains, used only to exercise
  // email-domain association on loopback. Never contacted.
  campus_cu: { id: "local_campus_cu", email: "polis-fixture-cu@cornell.edu", name: "Test Cornell student" },
  campus_uf: { id: "local_campus_uf", email: "polis-fixture-uf@ufl.edu", name: "Test UF student" },
  // Reserved example.edu: a campus with no community yet.
  campus_new: { id: "local_campus_new", email: "polis-fixture@example.edu", name: "Test new-campus student" },
  beta_b: { id: "local_beta_b", email: "beta_b@sites.test", name: "Beta Blair" },
  beta_c: { id: "local_beta_c", email: "beta_c@sites.test", name: "Beta Casey" },
};
// Run-scoped identities (qa_<suite>_<run>_<role>) let a suite start every run
// from accounts that no other run has touched.
const runAccount = /^qa_[a-z]{2,12}_[a-z0-9]{4,12}_[a-z0-9]{1,8}$/;

function accountFor(account: string | null | undefined, testAccounts: boolean): LocalAccount | undefined {
  if (!account) return undefined;
  if (account === "1") return owner;
  if (!testAccounts) return undefined;
  if (Object.hasOwn(testIdentities, account)) return testIdentities[account];
  if (runAccount.test(account)) return { id: "local_" + account, email: account + "@sites.test", name: "Test " + account };
  return undefined;
}

// Like the hosted sign-in, which confirms each email before admitting anyone.
export function localIdentity(account: string | null | undefined, testAccounts: boolean): Identity | null {
  const found = accountFor(account, testAccounts);
  return found ? { userId: found.id, email: found.email, displayName: found.name, verifiedCampusEmail: true } : null;
}

export function isLoopbackHost(host: string | null | undefined) {
  if (!host) return false;
  try {
    return localHosts.has(new URL("http://" + host).hostname.replace(/^\[|\]$/g, "").toLowerCase());
  } catch {
    return false;
  }
}

const plain = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { "Cache-Control": "private, no-store", ...headers } });

// Answers the sign-in and sign-out paths; every other request passes through
// (null) and reads its identity from the cookie set here.
export function localAuthResponse(request: Request, testAccounts: boolean): Response | null {
  const url = new URL(request.url);
  const signIn = url.pathname === SIGN_IN_PATH;
  const signOut = url.pathname === SIGN_OUT_PATH;
  if (!signIn && !signOut) return null;
  const host = request.headers.get("host");
  if (!isLoopbackHost(host) || new URL(url.protocol + "//" + host).origin !== url.origin) return plain(403);
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") return plain(403);
  const purposes = [request.headers.get("purpose"), request.headers.get("sec-purpose")];
  if (
    request.headers.has("next-router-prefetch") ||
    request.headers.get("x-middleware-prefetch") === "1" ||
    purposes.some((v) => v?.split(/[;,]/).some((part) => part.trim().toLowerCase() === "prefetch"))
  )
    return plain(204);
  if (request.method !== "GET" && (!signOut || request.method !== "POST")) return plain(405, { Allow: signIn ? "GET" : "GET, POST" });

  const requested = url.searchParams.get("test_account");
  // A mistyped test account must not quietly become the pilot owner.
  if (signIn && testAccounts && requested && !accountFor(requested, true)) return plain(400);
  const account = testAccounts && requested ? requested : "1";
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return plain(request.method === "POST" ? 303 : 302, {
    Location: new URL(safeReturnPath(url.searchParams.get("redirect_url") ?? url.searchParams.get("return_to")), url.origin).href,
    "Set-Cookie": LOCAL_AUTH_COOKIE + "=" + (signIn ? account : "") + "; Path=/; " + (signOut ? "Max-Age=0; " : "") + "HttpOnly; SameSite=Lax" + secure,
  });
}
