import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// This writes synthetic records in local D1. It must never run against a host.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://127.0.0.1:5176";
const url = new URL(origin);
assert.ok(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
const require = createRequire(process.env.POLIS_BROWSER_PACKAGE_ROOT
  ? path.join(process.env.POLIS_BROWSER_PACKAGE_ROOT, "package.json") : import.meta.url);
const { chromium, expect: baseExpect } = require("playwright/test");
const expect = baseExpect.configure({ timeout: 10000 });
const output = path.resolve("outputs/social-cycle");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], failedTiles = [], checks = [];
const runLabel = "SYNTHETIC BROWSER TEST " + Date.now();
const contexts = [];
function pass(name) { checks.push(name); console.log("PASS " + name); }
async function actor(account, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600, reducedMotion: "reduce", timezoneId: "America/New_York" });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.stack || e.message));
  page.on("response", r => {
    if (r.url().includes("tile.openstreetmap.org") && (r.status() >= 400 || r.headers()["x-blocked"]))
      failedTiles.push({ status: r.status(), blocked: !!r.headers()["x-blocked"] });
  });
  await page.goto(origin + "/signin-with-chatgpt?test_account=" + account + "&return_to=%2F%23home");
  await expect(page.getByRole("button", { name: /^Notifications,/ })).toBeVisible();
  const state = await (await context.request.get(origin + "/api/polis")).json();
  assert.equal(state.status, "ready", "Run local HTTP fixtures first.");
  assert.ok(state.me.username.startsWith("beta_"), "Synthetic memberships only.");
  return { context, page, id: state.me.id };
}
async function read(a, params = {}) {
  const response = await a.context.request.get(origin + "/api/polis?" + new URLSearchParams(params));
  assert.equal(response.status(), 200);
  return response.json();
}
async function setup(a, data) {
  const response = await a.context.request.post(origin + "/api/polis", {
    headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), data },
  });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
async function go(a, hash) {
  const destination = origin + "/#" + hash;
  if (a.page.url() === destination) await a.page.reload();
  else {
    await a.page.goto(destination);
    // Enter as a returning visitor; a hash-only navigation otherwise retains
    // the prior inbox until its asynchronous refresh completes.
    await a.page.reload();
  }
  await expect(a.page.getByRole("button", { name: /^Notifications,/ })).toBeVisible();
}
async function layout(page, name) {
  const width = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(width.page <= width.viewport + 1, `${name}: horizontal overflow ${JSON.stringify(width)}`);
  pass(name + " has no horizontal document overflow");
}
async function sendComment(a, label, text) {
  const input = a.page.getByRole("textbox", { name: label, exact: true });
  await input.fill(text);
  const [response] = await Promise.all([
    a.page.waitForResponse(r => r.request().method() === "POST" &&
      r.url().endsWith("/api/polis") && r.request().postDataJSON()?.data?.action === "comment"),
    input.locator("xpath=ancestor::form").getByRole("button", { name: "Reply", exact: true }).click(),
  ]);
  const value = await response.json();
  assert.ok(value.commentId);
  await expect(a.page.locator("#comment-" + value.commentId)).toContainText(text);
  return value.commentId;
}
try {
  const a = await actor("1", { width: 1440, height: 1000 });
  const b = await actor("beta_b", { width: 390, height: 844 });
  const c = await actor("beta_c", { width: 390, height: 844 });
  assert.equal(new Set([a.id, b.id, c.id]).size, 3);
  for (const [person, targetId] of [[a, b.id], [b, a.id]]) {
    await setup(person, { action: "block", targetId, enabled: false });
    await setup(person, { action: "mute", targetId, enabled: false });
  }
  await setup(a, { action: "friend", targetId: b.id, operation: "remove" });
  await go(a, "friends");
  await a.page.getByRole("tab", { name: "Friends", exact: true }).focus();
  await a.page.keyboard.press("ArrowRight");
  await expect(a.page.getByRole("tab", { name: "Requests", exact: true })).toBeFocused();
  await expect(a.page).toHaveURL(origin + "/#friends/requests");
  await a.page.getByRole("tab", { name: "Discover people", exact: true }).click();
  await a.page.locator(".person-row").filter({ hasText: "@beta_b" }).getByRole("button", { name: "Add friend", exact: true }).click();
  await expect(a.page.locator(".person-row").filter({ hasText: "@beta_b" }).getByRole("button", { name: "Cancel request", exact: true })).toBeVisible();
  await go(b, "notifications");
  await b.page.getByRole("button", { name: /^Beta Alex sent you a friend request/ }).first().click();
  await expect(b.page).toHaveURL(origin + "/#friends/requests");
  await b.page.getByRole("button", { name: "Accept request", exact: true }).click();
  await expect(b.page.getByRole("button", { name: "Accept request", exact: true })).toHaveCount(0);
  assert.ok((await read(a)).people.some(p => p.id === b.id && p.relationship === "friends"));
  pass("Friend request and acceptance through the correct notification destination");
  const text = runLabel + " · Reliable evening buses would help me participate locally. What trips matter to you?";
  await b.page.getByRole("button", { name: "Post", exact: true }).click();
  const dialog = b.page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Subject", exact: true }).selectOption("transit");
  await dialog.getByRole("textbox", { name: "In your own words", exact: true }).fill(text);
  await expect(dialog.getByRole("combobox", { name: "Who can see this?", exact: true })).toHaveValue("friends");
  await layout(b.page, "Mobile composer");
  let dropped = false, committedPost;
  const requestIds = [];
  await b.page.route("**/api/polis", async route => {
    const request = route.request();
    const data = request.method() === "POST" ? request.postDataJSON() : null;
    if (data?.data?.action === "post" && data.data.text === text) {
      requestIds.push(data.requestId);
      if (!dropped) {
        dropped = true;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        committedPost = (await response.json()).postId;
        await route.abort("failed"); // Server committed; browser lost the response.
        return;
      }
    }
    await route.continue();
  });
  await dialog.getByRole("button", { name: "Publish to Friends", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "In your own words", exact: true })).toHaveValue(text);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await b.page.getByRole("button", { name: /^Notifications,/ }).click();
  const marked = b.page.waitForResponse(r => r.request().method() === "POST" && r.request().postDataJSON()?.data?.action === "notifications.read");
  await b.page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await marked;
  await b.page.reload();
  await b.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "In your own words", exact: true })).toHaveValue(text);
  await dialog.getByRole("button", { name: "Publish to Friends", exact: true }).click();
  await expect(b.page).toHaveURL(origin + "/#post/" + committedPost);
  await b.page.unroute("**/api/polis");
  assert.equal(requestIds.length, 2);
  assert.equal(requestIds[0], requestIds[1]);
  assert.equal((await read(b)).posts.filter(p => p.text === text).length, 1);
  pass("Mobile opinion publish, default Friends, lost-response draft retained through another command/reload and idempotent retry");
  await b.page.reload();
  await expect(b.page.locator(".post-text")).toHaveText(text);
  await go(a, "home");
  const card = a.page.locator("#post-" + committedPost);
  await expect(card).toContainText(text);
  await card.getByRole("button", { name: /^Agree(?: \d+)?$/ }).click();
  await expect(card.getByRole("button", { name: /^Agree(?: \d+)?$/ })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /^Thought-provoking(?: \d+)?$/ }).click();
  await expect(card.getByRole("button", { name: /^Agree(?: \d+)?$/ })).toHaveAttribute("aria-pressed", "false");
  await expect(card.getByRole("button", { name: /^Thought-provoking(?: \d+)?$/ })).toHaveAttribute("aria-pressed", "true");
  await a.page.reload();
  await expect(card.getByRole("button", { name: /^Thought-provoking(?: \d+)?$/ })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /^Thought-provoking(?: \d+)?$/ }).click();
  await expect(card.getByRole("button", { name: /^Thought-provoking(?: \d+)?$/ })).toHaveAttribute("aria-pressed", "false");
  const post = (await read(b, { post: committedPost })).posts[0];
  assert.equal(post.reactions.reduce((n, r) => n + r.count, 0), 0);
  await card.getByRole("button", { name: /^Open conversation/ }).click();
  const comment = await sendComment(a, "Join the conversation", runLabel + " · Would later evening service help?");
  pass("Friend feed, reaction add/change/remove across reload, and first comment");
  await go(b, "notifications");
  await b.page.getByRole("button", { name: /^Beta Alex replied to your conversation/ }).first().click();
  await expect(b.page).toHaveURL(origin + "/#post/" + committedPost + "/" + comment);
  const commentRow = b.page.locator("#comment-" + comment);
  await expect(commentRow).toBeVisible();
  await commentRow.getByRole("button", { name: "Reply", exact: true }).click();
  const responseText = runLabel + " · Yes, especially after a library shift.";
  const reply = await sendComment(b, "Reply to this comment", responseText);
  await layout(b.page, "Mobile conversation");
  await b.page.screenshot({ path: path.join(output, "mobile-conversation.png"), fullPage: true });
  await go(a, "notifications");
  await a.page.getByRole("button", { name: /^Beta Blair replied to your conversation/ }).first().click();
  await expect(a.page).toHaveURL(origin + "/#post/" + committedPost + "/" + reply);
  await expect(a.page.locator("#comment-" + reply)).toContainText(responseText);
  await a.page.reload();
  await expect(a.page.locator("#comment-" + reply)).toContainText(responseText);
  await layout(a.page, "Desktop conversation");
  await a.page.screenshot({ path: path.join(output, "desktop-conversation.png"), fullPage: true });
  assert.ok((await read(a)).notifications.find(n => n.commentId === reply)?.readAt);
  pass("Notification opens exact comment, one-level reply, return via exact notification and read persistence");
  const denied = await c.context.request.get(origin + "/api/polis?post=" + committedPost);
  assert.equal(denied.status(), 404);
  await go(c, "post/" + committedPost);
  await expect(c.page.getByText(text, { exact: true })).toHaveCount(0);
  await expect(c.page.getByRole("alert")).toBeVisible();
  pass("Unrelated account cannot retrieve private conversation through API or browser deep link");

  await go(b, "explore/events");
  await b.page.getByRole("button", { name: "Your interests", exact: true }).click();
  await b.page.getByRole("dialog").getByLabel("Food & markets", { exact: true }).check();
  await b.page.getByRole("dialog").getByLabel("Outdoors", { exact: true }).check();
  await b.page.getByRole("button", { name: "Save interests", exact: true }).click();
  await expect(b.page.getByRole("dialog")).toHaveCount(0);
  await b.page.reload();
  const preferences = (await read(b)).eventPreferences;
  assert.ok(preferences.interests.includes("food_markets") && preferences.interests.includes("outdoors"));
  await b.page.getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(b.page.getByText("Location was not shared. You can still browse by city.")).toBeVisible();
  await b.page.getByRole("combobox", { name: "Category", exact: true }).selectOption("food_markets");
  await b.page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(b.page.locator(".polis-venue-pin")).toHaveCount(1);
  await b.page.locator(".polis-venue-pin").click();
  await expect(b.page.locator(".community-event-card.selected")).toHaveCount(1);
  assert.ok(new URL(b.page.url()).hash.includes("selected="));
  const selection = b.page.locator(".community-event-card.selected");
  const eventId = (await selection.getAttribute("id")).replace("event-card-", "");
  await layout(b.page, "Mobile event map/list");
  await b.page.screenshot({ path: path.join(output, "mobile-discovery.png"), fullPage: true });
  await selection.getByRole("button", { name: "Details", exact: true }).click();
  await expect(b.page).toHaveURL(origin + "/#event/" + eventId);
  if (await b.page.getByRole("button", { name: "Remove plan", exact: true }).count()) {
    await b.page.getByRole("button", { name: "Remove plan", exact: true }).click();
    await expect(b.page.getByRole("button", { name: "Remove plan", exact: true })).toHaveCount(0);
  }
  if (await b.page.getByRole("button", { name: "Saved · Undo", exact: true }).count()) {
    await b.page.getByRole("button", { name: "Saved · Undo", exact: true }).click();
  }
  await b.page.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(b.page.getByRole("button", { name: "Saved · Undo", exact: true })).toBeVisible();
  await b.page.getByRole("combobox", { name: "Attendance visibility", exact: true }).selectOption("only_me");
  await b.page.getByRole("button", { name: "Going", exact: true }).click();
  await expect(b.page.locator(".event-plan-confirmed")).toContainText("Going · Private");
  await b.page.reload();
  await expect(b.page.getByRole("button", { name: "Saved · Undo", exact: true })).toBeVisible();
  await expect(b.page.locator(".event-plan-confirmed")).toContainText("Going · Private");
  assert.ok(!(await read(a)).plans.some(p => p.userId === b.id && p.eventId === eventId));
  assert.ok(!(await read(c)).plans.some(p => p.userId === b.id && p.eventId === eventId));
  await b.page.getByRole("combobox", { name: "Attendance visibility", exact: true }).selectOption("friends");
  await b.page.getByRole("button", { name: "Save new visibility", exact: true }).click();
  await expect(b.page.locator(".event-plan-confirmed")).toContainText("Going · Friends");
  await layout(b.page, "Mobile event detail");
  await b.page.screenshot({ path: path.join(output, "mobile-event.png"), fullPage: true });
  await go(a, "event/" + eventId);
  await expect(a.page.getByRole("button", { name: "Beta Blair", exact: true }).first()).toBeVisible();
  assert.ok((await read(a)).plans.some(p => p.userId === b.id && p.eventId === eventId));
  assert.ok(!(await read(c)).plans.some(p => p.userId === b.id && p.eventId === eventId));
  pass("Interests, denied location, map/list selection, private save, private RSVP, explicit friends visibility and reload");

  await setup(b, { action: "friend", targetId: a.id, operation: "remove" });
  assert.equal((await a.context.request.get(origin + "/api/polis?post=" + committedPost)).status(), 404);
  assert.ok(!(await read(a)).notifications.some(n => n.targetId === committedPost));
  await go(a, "post/" + committedPost + "/" + reply);
  await expect(a.page.getByText(responseText, { exact: true })).toHaveCount(0);
  await expect(a.page.getByRole("alert")).toBeVisible();
  await setup(a, { action: "friend", targetId: b.id, operation: "request" });
  await setup(b, { action: "friend", targetId: a.id, operation: "accept" });
  pass("Revoked friendship removes conversation, attendance and notification access");
  const noStorage = await a.context.newPage();
  await noStorage.addInitScript(() => Object.defineProperty(window, "sessionStorage", {
    configurable: true, get() { throw new DOMException("Storage disabled", "SecurityError"); },
  }));
  const noStorageActor = { ...a, page: noStorage };
  await go(noStorageActor, "post/" + committedPost);
  const repeatedText = runLabel + " · Intentional repeated reply with storage disabled.";
  const firstRepeat = await sendComment(noStorageActor, "Join the conversation", repeatedText);
  const secondRepeat = await sendComment(noStorageActor, "Join the conversation", repeatedText);
  assert.notEqual(firstRepeat, secondRepeat);
  await noStorage.close();
  pass("Successful replies clear in-memory retry identity when browser storage is unavailable");
  assert.deepEqual(errors, [], "Browser JavaScript errors");
  await writeFile(path.join(output, "results.json"), JSON.stringify({
    checkedAt: new Date().toISOString(), mode: "local synthetic accounts", browser: await browser.version(),
    checks, failedTiles, errors, hostedAuthenticationVerified: false,
  }, null, 2));
  console.log("PASS browser social cycle. Hosted ChatGPT accounts and deployment remain unverified.");
  if (failedTiles.length) console.log("LIMITATION basemap provider blocked " + failedTiles.length + " tile responses.");
} catch (e) {
  console.error(e);
  for (let i = 0; i < contexts.length; i++) {
    const page = contexts[i].pages()[0];
    await page.screenshot({ path: path.join(output, "failure-" + i + ".png"), fullPage: true }).catch(() => {});
    await writeFile(path.join(output, "failure-" + i + ".txt"), await page.locator("body").ariaSnapshot()).catch(() => {});
  }
  process.exitCode = 1;
} finally { await browser.close(); }
