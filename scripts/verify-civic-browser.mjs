import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { expect as baseExpect } from "playwright/test";

// Journeys A–E for the campus Commons, civic map and entity cards.
// Synthetic LOCAL identities only (POLIS_TEST_ACCOUNTS=1); never a hosted URL.
// Creates clearly labeled fixtures in the local database it runs against.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5173";
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin), "Local origins only.");
const expect = baseExpect.configure({ timeout: 20000 });
const output = "/tmp/polis-civic-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const stamp = Date.now().toString(36).toUpperCase();

async function actor(account, width = 1440, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(account + ": " + e.message));
  await page.goto(origin + "/signin-with-chatgpt?test_account=" + account + "&return_to=" + encodeURIComponent("/#home"));
  return { context, page, account };
}
async function command(a, data, expected = 200) {
  const r = await a.context.request.post(origin + "/api/polis", { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), data } });
  const result = await r.json();
  assert.equal(r.status(), expected, result.error ?? data.action);
  return result;
}
async function state(a, params = "") {
  const r = await a.context.request.get(origin + "/api/polis" + params);
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function ensureProfile(a, username) {
  const s = await state(a);
  if (s.status !== "onboarding") return false;
  await expect(a.page.getByRole("button", { name: "Create my Polis account" })).toBeVisible();
  await a.page.getByLabel("Username").fill(username);
  await a.page.getByRole("button", { name: "Create my Polis account" }).click();
  await expect(a.page.getByRole("heading", { level: 1 })).toContainText("today");
  return true;
}
async function shot(a, name) {
  await expect(a.page.getByText("Loading your community…", { exact: true })).toHaveCount(0);
  assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + " horizontal overflow");
  await a.page.screenshot({ path: output + "/" + name + ".png" });
}
const main = (a) => a.page.locator("#social-main .social-content");

// Owner prepares both campuses: listings and a memorable reusable code.
const owner = await actor("1");
if ((await state(owner)).status === "onboarding")
  await command(owner, { action: "account.create", name: "Local owner", username: "local_owner_" + stamp.toLowerCase() });
const code = "QA-" + stamp;
for (const campus of ["ithaca", "uf"]) {
  await command(owner, { action: "community.manage", communityId: campus });
  const s = await state(owner);
  if (!s.events.length) {
    const { curatedEventsFor } = await import("../lib/social/campus-events.ts");
    for (const event of curatedEventsFor(campus)) await command(owner, { action: "event.save", event, createOnly: true });
  }
}
await command(owner, { action: "community.select", communityId: "ithaca" });
await command(owner, { action: "invite.code", communityId: "ithaca", code, expiresDays: null, maxUses: 50 });

// Journey B: a ufl.edu account lands in UF / Gainesville, not Cornell.
const gator = await actor("campus_uf");
if (await ensureProfile(gator, "test_uf_" + stamp.toLowerCase().slice(-5))) {
  /* created */
} else await gator.page.goto(origin + "/#home");
await expect(main(gator)).toContainText("UNIVERSITY OF FLORIDA · GAINESVILLE, FL");
await expect(main(gator)).toContainText("What’s happening around UF today.");
await expect(main(gator)).not.toContainText("Ithaca");
await shot(gator, "b-uf-home-desktop");
await gator.page.goto(origin + "/#commons/local");
await expect(main(gator)).toContainText("What UF is talking about.");
await expect(main(gator)).not.toContainText("Cornell");
assert.equal((await state(gator)).community.id, "uf");
await command(gator, { action: "community.select", communityId: "ithaca" }, 403);

// Journey D: location declined still works from the campus center.
const denied = await actor("campus_uf", 390, { permissions: [] });
await denied.context.setGeolocation(null).catch(() => {});
await denied.page.goto(origin + "/#explore");
await expect(denied.page.getByRole("heading", { level: 1 })).toContainText("Around UF and Gainesville.");
await denied.page.getByRole("button", { name: "Use my location" }).click();
await expect(denied.page.getByRole("status").filter({ hasText: "Distances use the center of UF" })).toBeVisible();
await expect(denied.page.locator(".civic-map-list li").first()).toBeVisible();
await shot(denied, "d-uf-map-location-declined-mobile");

// Journeys A and C: a cornell.edu student opens a marker, discusses it, replies
// with a perspective and follows the related issue back to the map.
const student = await actor("campus_cu");
await ensureProfile(student, "test_cu_" + stamp.toLowerCase().slice(-5));
await student.page.goto(origin + "/#explore?layer=people");
await student.page.getByRole("button", { name: /Cornell Student Assembly/ }).first().click();
const card = student.page.locator(".entity-summary");
await expect(card).toContainText("Why it matters");
await card.getByRole("button", { name: "Discuss in The Commons" }).click();
await expect(student.page.getByRole("dialog")).toContainText("Start a discussion in The Commons");
await student.page.getByLabel(/Headline or question/).fill("QA " + stamp + ": How should the activity fee be decided?");
await student.page.getByLabel(/In your own words/).fill("Synthetic QA post. What would make the process clearer?");
await student.page.getByRole("button", { name: "Post to The Commons" }).click();
await expect(main(student)).toContainText("How should the activity fee be decided?");
await expect(main(student).locator(".post-about")).toContainText("Cornell Student Assembly");
await shot(student, "c-discussion-from-map");

await student.page.goto(origin + "/#commons/campus");
await expect(main(student)).toContainText("What Cornell is talking about.");
await student.page.goto(origin + "/#entity/q-cu-north-bus");
await expect(main(student)).toContainText("Reasons people support it");
await student.page.getByRole("button", { name: "Share your perspective" }).click();
await student.page.getByLabel(/Your position/).selectOption("reservations");
await student.page.getByLabel(/In your own words/).fill("Synthetic QA response " + stamp + ".");
await student.page.getByRole("button", { name: "Post to The Commons" }).click();
await expect(main(student)).toContainText("Synthetic QA response " + stamp);
await student.page.locator("#discussion-reply textarea").fill("Synthetic QA reply with a perspective.");
await student.page.locator("#discussion-reply").getByText("Mixed", { exact: true }).click();
await student.page.locator("#discussion-reply").getByRole("button", { name: /Reply/ }).click();
await expect(main(student).locator(".reply-position").last()).toHaveText("Mixed");
await student.page.goto(origin + "/#entity/cu-late-night-bus");
await student.page.getByRole("button", { name: "Show on map" }).click();
await expect(student.page.locator(".entity-summary")).toContainText("Late-night bus service to North Campus");
await shot(student, "a-issue-on-map");

// Journey E: a sites.test account joins Cornell with the reusable memorable code.
const invited = await actor("ithaca_c");
await invited.page.goto(origin + "/#join/ithaca");
await invited.page.getByLabel("Invite code").fill(code.toLowerCase().replace("-", " "));
await invited.page.getByRole("button", { name: "Check code" }).click();
await expect(invited.page.locator(".invite-result")).toContainText("Cornell / Ithaca");
if (await invited.page.getByLabel("Username").isVisible().catch(() => false)) {
  await invited.page.getByLabel("Your name").fill("Test invited member");
  await invited.page.getByLabel("Username").fill("test_inv_" + stamp.toLowerCase().slice(-5));
}
await invited.page.getByRole("button", { name: /Join Cornell|Continue to community/ }).click();
await expect.poll(async () => (await state(invited)).communities.some((c) => c.id === "ithaca")).toBe(true);
await expect(main(invited)).toContainText("What’s happening around Cornell today.");
await shot(invited, "e-joined-with-code");

await browser.close();
assert.deepEqual(errors, []);
console.log("Civic journeys A–E passed. Screenshots:", output);
