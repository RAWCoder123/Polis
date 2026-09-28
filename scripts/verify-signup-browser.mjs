import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";
import { expect } from "playwright/test";

// Run on a migrated, disposable local database with POLIS_TEST_ACCOUNTS=1.
// These identities are synthetic and cannot be used by the production Worker.
// Each run signs up two new run-scoped accounts, so it can repeat on one database.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5181";
const url = new URL(origin);
assert.ok(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
const output = "/tmp/polis-signup-qa";
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const errors = [];
const actors = [];
const run = Date.now().toString(36);
async function state(actor) {
  const response = await actor.context.request.get(origin + "/api/polis");
  assert.equal(response.status(), 200);
  return response.json();
}
async function command(actor, data) {
  const response = await actor.context.request.post(origin + "/api/polis", { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), data } });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
try {
  for (const [role, width] of [["b", 390], ["c", 1440]]) {
    const account = "qa_signup_" + run + "_" + role;
    const username = "signup_" + run + "_" + role;
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    const actor = { context, page }; actors.push(actor);
    await page.goto(origin + "/#signup");
    await expect(page.getByRole("heading", { name: "Your perspective belongs here." })).toBeVisible();
    await page.getByRole("link", { name: "Enter an optional invite code" }).click();
    await expect(page.getByRole("heading", { name: "Enter invite code" })).toBeVisible();
    await page.getByRole("link", { name: "Continue without a code" }).click();
    await page.route("**/signin-with-chatgpt?**", route => {
      const login = new URL(route.request().url()); login.searchParams.set("test_account", account);
      return route.continue({ url: login.href });
    });
    await page.getByRole("link", { name: "Continue with OpenAI", exact: true }).click();
    const snapshot = await state(actor);
    assert.equal(snapshot.status, "onboarding", "Each run signs up a new synthetic account.");
    await expect(page.getByRole("heading", { name: "Make yourself at home." })).toBeVisible();
    await page.getByRole("textbox", { name: "Your name", exact: true }).fill("Test " + account);
    await page.getByRole("textbox", { name: "Username", exact: true }).fill(username);
    let failed = false;
    await page.route("**/api/polis", route => {
      if (!failed && route.request().method() === "POST" && route.request().postDataJSON()?.data?.action === "account.create") {
        failed = true;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary test failure. Please retry." }) });
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "Create my Polis account" }).click();
    await expect(page.locator(".account-entry [role=alert]")).toContainText("Temporary test failure");
    await expect(page.getByRole("textbox", { name: "Username", exact: true })).toHaveValue(username);
    await page.screenshot({ path: output + "/setup-" + width + ".png", fullPage: true });
    await page.getByRole("button", { name: "Create my Polis account" }).click();
    // Members without a campus email are guided to find their local community first.
    await expect(page.getByRole("heading", { name: "Polis is a commons for a real place." })).toBeVisible();
    await page.goto(origin + "/#home");
    await expect(page.getByText("Welcome to Polis commons.", { exact: true })).toBeVisible();
    await page.reload();
    assert.equal((await state(actor)).community.id, "polis");
    const denied = await context.request.get(origin + "/api/polis?community=ithaca");
    assert.equal(denied.status(), 403);
    await expect(page.getByRole("combobox", { name: "Current community" })).toHaveValue("polis");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: output + "/home-" + width + ".png", fullPage: false });
    await page.goto(origin + "/#profile");
    await expect(page.getByRole("heading", { name: "Enter invite code" })).toHaveCount(0);
    console.log("PASS signup, optional-code skip, reload, protected community, profile, layout: " + width);
  }
  await command(actors[0], { action: "preferences", replies: true, reactions: false, issues: false, events: false });
  const post = await command(actors[0], { action: "post", kind: "question", subjectId: "community", audience: "community", text: "Synthetic signup QA: how can neighbors get involved?" });
  await command(actors[1], { action: "comment", postId: post.postId, text: "Synthetic QA reply from a separate account." });
  assert.ok((await state(actors[0])).notifications.some(n => n.targetId === post.postId));
  await actors[0].page.goto(origin + "/#post/" + post.postId);
  await expect(actors[0].page.getByText("Synthetic QA reply from a separate account.", { exact: true })).toBeVisible();
  await actors[0].page.reload();
  await expect(actors[0].page.getByText("Synthetic QA reply from a separate account.", { exact: true })).toBeVisible();
  await command(actors[0], { action: "post.delete", postId: post.postId });
  assert.deepEqual(errors, []);
  console.log("PASS two-account shared conversation, notification, deep link and reload. Screenshots: " + output);
} finally { await browser.close(); }
