import test from "node:test";
import assert from "node:assert/strict";
import { LOCAL_AUTH_COOKIE, localAuthResponse, localIdentity } from "../lib/auth/local.ts";
import { safeReturnPath, signInPath } from "../lib/auth/paths.ts";

// Drives the loopback-only development sign-in the local suites use.
function localSignIn(testAccounts: boolean) {
  const signIn = (path: string, init: { host?: string; method?: string; headers?: Record<string, string> } = {}) => {
    const host = init.host ?? "localhost:5173";
    const response = localAuthResponse(
      new Request("http://" + host + path, { method: init.method ?? "GET", headers: { host, ...init.headers } }),
      testAccounts,
    );
    return { response, status: response?.status, cookie: response?.headers.get("set-cookie")?.split(";")[0], location: response?.headers.get("location") };
  };
  const user = (cookie: string) => localIdentity(cookie.split("=")[1], testAccounts);
  return { signIn, user };
}

test("run-scoped synthetic accounts sign in as separate local identities only with POLIS_TEST_ACCOUNTS=1", () => {
  const { signIn, user } = localSignIn(true);
  const b = signIn("/sign-in?test_account=qa_signup_mg2k3x9a_b&return_to=%2F%23home");
  assert.equal(b.status, 302);
  assert.equal(b.cookie, LOCAL_AUTH_COOKIE + "=qa_signup_mg2k3x9a_b");
  assert.equal(b.location, "http://localhost:5173/#home");
  assert.equal(user(b.cookie!)?.userId, "local_qa_signup_mg2k3x9a_b");
  assert.equal(user(b.cookie!)?.email, "qa_signup_mg2k3x9a_b@sites.test");
  assert.equal(localIdentity("qa_signup_mg2k3x9a_c", true)?.userId, "local_qa_signup_mg2k3x9a_c");
  assert.equal(localIdentity("beta_b", true)?.userId, "local_beta_b");

  // Anything outside the strict pattern is refused rather than quietly signing
  // in as the pilot owner, and is never accepted as a session cookie.
  for (const account of ["qa_signup", "qa_signup_mg2k3x9a_b_extra", "QA_signup_mg2k3x9a_b", "qa_s_mg2k3x9a_b", "qa_signup_mg2k3x9a_toolongrole", "qa_usab_r1a_a", "constructor", "__proto__"]) {
    const refused = signIn("/sign-in?test_account=" + account);
    assert.equal(refused.status, 400, account);
    assert.equal(refused.cookie, undefined, account);
    assert.equal(localIdentity(account, true), null, account);
  }
});

test("without POLIS_TEST_ACCOUNTS only the example owner can sign in locally", () => {
  const { signIn } = localSignIn(false);
  for (const account of ["qa_signup_mg2k3x9a_b", "beta_b"]) {
    assert.equal(signIn("/sign-in?test_account=" + account).cookie, LOCAL_AUTH_COOKIE + "=1");
    assert.equal(localIdentity(account, false), null);
  }
  assert.equal(localIdentity("1", false)?.userId, "local_seedy");
  assert.equal(localIdentity(undefined, false), null);
});

test("the local sign-in answers only same-origin loopback navigations", () => {
  const { signIn } = localSignIn(true);
  assert.equal(signIn("/sign-in", { host: "polis.example" }).status, 403);
  assert.equal(signIn("/sign-in", { host: "192.168.1.20:5173" }).status, 403);
  assert.equal(signIn("/sign-in", { headers: { origin: "https://elsewhere.example" } }).status, 403);
  assert.equal(signIn("/sign-in", { headers: { "sec-fetch-site": "cross-site" } }).status, 403);
  assert.equal(signIn("/sign-in", { headers: { "next-router-prefetch": "1" } }).status, 204);
  assert.equal(signIn("/sign-in", { method: "POST" }).status, 405);
  const out = signIn("/sign-out?return_to=%2F", { method: "POST" });
  assert.equal(out.status, 303);
  assert.equal(out.cookie, LOCAL_AUTH_COOKIE + "=");
  // Other paths pass through untouched.
  assert.equal(signIn("/api/polis").response, null);
  assert.equal(signIn("/sign-in/factor-one").response, null);
});

test("sign-in destinations stay on this site", () => {
  for (const unsafe of ["https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, "/sign-in", "/sign-out?x=1", "/signin-with-chatgpt"])
    assert.equal(safeReturnPath(unsafe), "/", String(unsafe));
  assert.equal(safeReturnPath("/#join/ithaca"), "/#join/ithaca");
  assert.equal(safeReturnPath("/welcome?x=1#a"), "/welcome?x=1#a");
  assert.equal(signInPath("https://evil.example/"), "/sign-in?redirect_url=%2F");
  assert.equal(signInPath("/#home"), "/sign-in?redirect_url=%2F%23home");
});
