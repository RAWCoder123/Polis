import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { expect as baseExpect } from "playwright/test";

// Motion and perceived speed, matched to the launch film: page transitions by
// direction, cards growing into pages, remembered views on return, instant
// reactions that roll back on failure, arriving replies, and none of it when
// reduced motion is preferred. Synthetic LOCAL identities only
// (POLIS_TEST_ACCOUNTS=1: motion_a, motion_b).
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5173";
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin), "Local origins only.");
const expect = baseExpect.configure({ timeout: 15000 });
const output = "/tmp/polis-motion-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const pages = [];
// On failure, keep a screenshot of every page so the cause is visible.
process.on("uncaughtException", async (e) => {
  await Promise.all(pages.map((p, i) => p.screenshot({ path: output + "/failure-" + i + ".png" }).catch(() => {})));
  console.error(e);
  process.exit(1);
});
const stamp = Date.now().toString(36);

async function actor(account, width, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, ...options });
  const page = await context.newPage();
  pages.push(page);
  page.on("pageerror", (e) => {
    errors.push(account + ": " + e.message);
    console.error("Page error (" + account + "):", e.name, e.message);
  });
  await page.goto(origin + "/signin-with-chatgpt?test_account=" + account + "&return_to=" + encodeURIComponent("/#home"));
  const a = { context, page };
  const state = await snapshot(a);
  if (state.status === "onboarding") {
    await page.getByLabel("Username").fill(account + "_" + stamp.slice(-5));
    await page.getByRole("button", { name: "Create my Polis account" }).click();
    await expect.poll(async () => (await snapshot(a)).status).toBe("ready");
  }
  await command(a, { action: "community.joinOpen" });
  return a;
}
async function snapshot(a) {
  const r = await a.context.request.get(origin + "/api/polis");
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function command(a, data) {
  const r = await a.context.request.post(origin + "/api/polis", { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), data } });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
const vt = (page) => page.evaluate(() => document.documentElement.dataset.vt ?? "none");
// The transition kind shortly after an action, then waits for it to finish.
async function kindOf(page, act) {
  await act();
  await page.waitForTimeout(90);
  const kind = await vt(page);
  await expect.poll(() => vt(page)).toBe("none");
  return kind;
}
// Delays API reads so remembered content can be told apart from fresh content.
async function slowReads(page, ms) {
  await page.route("**/api/polis?**", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue().catch(() => {});
  });
}

const title = "Motion QA " + stamp + ": where should the next bench go?";

// Desktop, with motion.
const a = await actor("motion_a", 1280);
await command(a, { action: "post", kind: "question", subjectId: "community", audience: "community", title, text: "Synthetic motion regression thread." });
const { page } = a;
await page.goto(origin + "/#home");
await expect(page.getByText("Loading your community…", { exact: true })).toHaveCount(0);
await expect(page.locator(".social-sidebar nav")).toBeVisible();

// Navigation cross-fades forward; the rail and header stay in place.
assert.equal(await kindOf(page, () => page.locator(".social-sidebar nav button", { hasText: "Commons" }).click()), "forward");
const card = page.locator(".social-post", { hasText: title });
await expect(card).toBeVisible();

// A tapped card grows into its conversation, which opens with its post at once
// while replies are still loading.
await slowReads(page, 900);
await card.getByRole("button", { name: /^Open conversation/ }).click();
await page.waitForTimeout(90);
assert.equal(await vt(page), "morph");
assert.ok(
  await page.evaluate(() => document.getAnimations().some((x) => x.effect?.pseudoElement === "::view-transition-group(polis-morph)")),
  "the card's container transform runs",
);
await expect(page.locator(".social-content .social-post").first()).toContainText(title, { timeout: 300 });
await expect.poll(() => vt(page)).toBe("none");
await page.unrouteAll({ behavior: "ignoreErrors" });
await expect(page.locator("#discussion-reply textarea")).toBeVisible();
await page.screenshot({ path: output + "/thread-desktop.png" });

// A new reply opens its own space instead of appearing all at once.
await page.evaluate(() => {
  window.__arrival = null;
  new MutationObserver(() => {
    const row = [...document.querySelectorAll(".comment-row")].find((r) => r.textContent.includes("Arrival check"));
    if (row && !window.__arrival) window.__arrival = row.getAnimations().length;
  }).observe(document.querySelector(".social-content"), { childList: true, subtree: true });
});
await page.locator("#discussion-reply textarea").fill("Arrival check " + stamp);
await page.locator("#discussion-reply").getByRole("button", { name: "Reply", exact: true }).click();
assert.ok((await (await page.waitForFunction(() => window.__arrival)).jsonValue()) >= 2, "a new reply animates into place");

// Back returns to the remembered Commons at once, without placeholders.
await slowReads(page, 900);
assert.equal(await kindOf(page, () => page.goBack()), "back");
await expect(card).toBeVisible({ timeout: 300 });
assert.equal(await page.locator(".skeleton-card").count(), 0);
await page.unrouteAll({ behavior: "ignoreErrors" });

// A fragment link animates forward even though it fires popstate.
assert.equal(
  await kindOf(page, () =>
    page.evaluate(() => {
      const link = Object.assign(document.createElement("a"), { href: "#friends" });
      document.body.append(link);
      link.click();
      link.remove();
    }),
  ),
  "forward",
);
// Tabs within the Commons change in place.
await page.goto(origin + "/#commons/for-you");
await expect.poll(() => vt(page)).toBe("none");
assert.equal(await kindOf(page, () => page.locator(".commons-tabs button", { hasText: "Trending" }).click()), "none");

// Interrupting a transition (a newer navigation, then a tap) finishes it
// cleanly: no unhandled rejections from skipped transitions.
await page.evaluate(() => {
  // A tap in the same moment as a navigation skips it before its first frame.
  [...document.querySelectorAll(".social-sidebar nav button")].find((b) => b.textContent.includes("Friends")).click();
  dispatchEvent(new PointerEvent("pointerdown"));
});
await expect.poll(() => vt(page)).toBe("none");
await expect(page).toHaveURL(/#friends$/);
await page.waitForTimeout(300);
assert.deepEqual(errors, [], "skipped transitions are not errors");
// A newer navigation during a transition wins; the older one never lands late.
await page.evaluate(() => {
  [...document.querySelectorAll(".social-sidebar nav button")].find((b) => b.textContent.includes("Home")).click();
  location.hash = "#commons/for-you";
});
await expect.poll(() => vt(page)).toBe("none");
await page.waitForTimeout(300);
await expect(page).toHaveURL(/#commons\/for-you$/);
await expect(page.locator(".commons-tabs")).toBeVisible();

// Reactions show immediately; other controls do not dim during the request;
// a failed request rolls the reaction back.
await page.goto(origin + "/#commons/for-you");
const reaction = page.locator(".social-post", { hasText: title }).locator(".reaction-set .reaction").first();
await expect(reaction).toHaveAttribute("aria-pressed", "false");
await page.route("**/api/polis", async (route) => {
  if (route.request().method() !== "POST") return route.continue();
  await new Promise((r) => setTimeout(r, 700));
  await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Synthetic failure." }) });
});
await reaction.click();
await page.waitForTimeout(80);
assert.equal(await reaction.getAttribute("aria-pressed"), "true", "the reaction shows before the server answers");
assert.equal(await page.locator(".social-sidebar nav button").first().evaluate((b) => getComputedStyle(b).opacity), "1");
await expect(reaction).toHaveAttribute("aria-pressed", "false");
await expect(page.locator(".social-error")).toContainText("Synthetic failure.");
await page.unrouteAll({ behavior: "ignoreErrors" });
await reaction.click();
await expect(reaction).toHaveAttribute("aria-pressed", "true");
assert.equal((await snapshot(a)).status, "ready");
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "desktop overflow");

// Phone: back is the film's edge swipe; the mobile tab bar stays in place.
const phone = await actor("motion_b", 390, { hasTouch: true, isMobile: true });
await phone.page.goto(origin + "/#commons/for-you");
const phoneCard = phone.page.locator(".social-post", { hasText: title });
await expect(phoneCard).toBeVisible();
assert.equal(await kindOf(phone.page, () => phoneCard.getByRole("button", { name: /^Open conversation/ }).click()), "morph");
await phone.page.goBack();
await phone.page.waitForTimeout(250);
assert.equal(await vt(phone.page), "back");
assert.ok(
  await phone.page.evaluate(() => document.getAnimations().some((x) => x.animationName === "polis-swipe-away")),
  "phones swipe the old page away",
);
await phone.page.screenshot({ path: output + "/back-swipe-phone.png" });
await expect.poll(() => vt(phone.page)).toBe("none");
assert.ok(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "phone overflow");

// Reduced motion: navigation and reactions change instantly.
const still = await actor("motion_b", 1280, { reducedMotion: "reduce" });
await still.page.goto(origin + "/#home");
await expect(still.page.getByText("Loading your community…", { exact: true })).toHaveCount(0);
await expect(still.page.locator(".social-sidebar nav")).toBeVisible();
assert.equal(await kindOf(still.page, () => still.page.locator(".social-sidebar nav button", { hasText: "Commons" }).click()), "none");
const stillCard = still.page.locator(".social-post", { hasText: title });
assert.equal(await kindOf(still.page, () => stillCard.getByRole("button", { name: /^Open conversation/ }).click()), "none");
await expect(still.page.locator(".social-content .social-post").first()).toContainText(title);
const stillReaction = still.page.locator(".social-content .social-post").first().locator(".reaction-set .reaction").nth(2);
await stillReaction.click();
assert.equal(await stillReaction.evaluate((b) => b.querySelector("svg")?.getAnimations().length ?? 0), 0);
await expect(stillReaction).toHaveAttribute("aria-pressed", "true");

await browser.close();
assert.deepEqual(errors, []);
console.log("PASS motion: forward, morph, back swipe, fragment links, in-page tabs, remembered views, instant and rolled-back reactions, reply arrival, reduced motion. Screenshots:", output);
