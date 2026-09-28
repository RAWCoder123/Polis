import test from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sites } from "../build/sites-vite-plugin.ts";

type Middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;

// Drives the loopback-only development sign-in middleware the local suites use.
function localSignIn(testAccounts: boolean) {
  const previous = process.env.POLIS_TEST_ACCOUNTS;
  if (testAccounts) process.env.POLIS_TEST_ACCOUNTS = "1";
  else delete process.env.POLIS_TEST_ACCOUNTS;
  let middleware: Middleware | undefined;
  try {
    const configure = sites().configureServer as unknown as (server: unknown) => void;
    configure({ config: { server: {}, logger: { info() {} } }, middlewares: { use: (m: Middleware) => (middleware = m) } });
  } finally {
    if (previous === undefined) delete process.env.POLIS_TEST_ACCOUNTS;
    else process.env.POLIS_TEST_ACCOUNTS = previous;
  }
  return (url: string, cookie = "", remoteAddress = "127.0.0.1") => {
    const headers: Record<string, string> = { host: "localhost:5173", ...(cookie ? { cookie } : {}) };
    const request = { url, method: "GET", headers, rawHeaders: Object.entries(headers).flat(), socket: { remoteAddress } };
    const sent: Record<string, string> = {};
    const response = { statusCode: 200, setHeader: (name: string, value: string) => (sent[name.toLowerCase()] = value), end() {} };
    let next = false;
    middleware!(request as unknown as IncomingMessage, response as unknown as ServerResponse, () => (next = true));
    return { next, status: response.statusCode, cookie: sent["set-cookie"]?.split(";")[0], user: headers["oai-authenticated-user-id"], email: headers["oai-authenticated-user-email"] };
  };
}

test("run-scoped synthetic accounts sign in as separate local identities only with POLIS_TEST_ACCOUNTS=1", () => {
  const request = localSignIn(true);
  const signIn = request("/signin-with-chatgpt?test_account=qa_signup_mg2k3x9a_b");
  assert.equal(signIn.status, 302);
  assert.equal(signIn.cookie, "__sites_local_auth=qa_signup_mg2k3x9a_b");
  const b = request("/api/polis", signIn.cookie);
  assert.equal(b.next, true);
  assert.equal(b.user, "local_qa_signup_mg2k3x9a_b");
  assert.equal(b.email, "qa_signup_mg2k3x9a_b@sites.test");
  assert.equal(request("/api/polis", "__sites_local_auth=qa_signup_mg2k3x9a_c").user, "local_qa_signup_mg2k3x9a_c");
  assert.equal(request("/api/polis", "__sites_local_auth=beta_b").user, "local_beta_b");
  // Only loopback requests receive a synthetic identity.
  assert.equal(request("/api/polis", signIn.cookie, "10.0.0.2").user, undefined);

  // Anything outside the strict pattern is refused rather than quietly signing
  // in as the pilot owner, and is never accepted as a session cookie.
  for (const account of ["qa_signup", "qa_signup_mg2k3x9a_b_extra", "QA_signup_mg2k3x9a_b", "qa_s_mg2k3x9a_b", "qa_signup_mg2k3x9a_toolongrole", "qa_usab_r1a_a", "constructor"]) {
    const refused = request("/signin-with-chatgpt?test_account=" + account);
    assert.equal(refused.status, 400, account);
    assert.equal(refused.cookie, undefined, account);
    assert.equal(request("/api/polis", "__sites_local_auth=" + account).user, undefined, account);
  }
});

test("without POLIS_TEST_ACCOUNTS only the example owner can sign in locally", () => {
  const request = localSignIn(false);
  for (const account of ["qa_signup_mg2k3x9a_b", "beta_b"]) {
    assert.equal(request("/signin-with-chatgpt?test_account=" + account).cookie, "__sites_local_auth=1");
    assert.equal(request("/api/polis", "__sites_local_auth=" + account).user, undefined);
  }
  assert.equal(request("/api/polis", "__sites_local_auth=1").user, "local_seedy");
});
