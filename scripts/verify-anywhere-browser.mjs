import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { expect as baseExpect } from "playwright/test";

// Polis beyond the configured campuses: find, start and join a town commons,
// found a campus under a new university domain, and discover communities near
// you. Synthetic LOCAL identities only (POLIS_TEST_ACCOUNTS=1). Uses the real
// OpenStreetMap place search and public-place import through the local Worker;
// set POLIS_SKIP_OSM=1 on networks where those services are blocked.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5173";
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin), "Local origins only.");
const expect = baseExpect.configure({ timeout: 30000 });
const output = "/tmp/polis-anywhere-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const stamp = Date.now().toString(36);

async function actor(account, width = 1440, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(account + ": " + e.message));
  await page.goto(origin + "/signin-with-chatgpt?test_account=" + account + "&return_to=" + encodeURIComponent("/#home"));
  return { context, page, account };
}
async function state(a, params = "") {
  const r = await a.context.request.get(origin + "/api/polis" + params);
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function ensureProfile(a, username) {
  if ((await state(a)).status !== "onboarding") return false;
  await a.page.getByLabel("Username").fill(username);
  await a.page.getByRole("button", { name: "Create my Polis account" }).click();
  return true;
}
async function shot(a, name) {
  await expect(a.page.getByText("Loading your community…", { exact: true })).toHaveCount(0);
  assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + " horizontal overflow");
  await a.page.screenshot({ path: output + "/" + name + ".png" });
}
const main = (a) => a.page.locator("#social-main .social-content");
async function findTown(a, query, city) {
  await a.page.goto(origin + "/#communities");
  await a.page.getByRole("textbox", { name: "Town, city or university" }).fill(query);
  await a.page.getByRole("button", { name: "Search", exact: true }).click();
  const existing = main(a).locator(".find-row").filter({ hasText: city }).getByRole("button", { name: /Join|Open/ });
  const start = main(a).getByRole("button", { name: "Start " + city });
  await expect(existing.or(start).first()).toBeVisible();
  return { existing, start };
}

// F: a member without a campus email starts (or finds) a town commons.
const founder = await actor("beta_b");
const created = await ensureProfile(founder, "town_founder_" + stamp.slice(-5));
if (created) await expect(founder.page.getByRole("heading", { name: "Polis is a commons for a real place." })).toBeVisible();
const { existing, start } = await findTown(founder, "Burlington, Vermont", "Burlington");
await shot(founder, "f-find-community-desktop");
if (await start.isVisible().catch(() => false)) await start.click();
else await existing.first().click();
await expect(main(founder)).toContainText("What’s happening around Burlington today.");
const s1 = await state(founder);
assert.equal(s1.community.locality.city, "Burlington");
if (!process.env.POLIS_SKIP_OSM) assert.ok(s1.places.length > 0, "public places imported from OpenStreetMap");
await expect(main(founder)).toContainText("Local council");
await shot(founder, "f-town-home-desktop");

// The town commons works end to end: start a discussion tied to a local office.
await founder.page.goto(origin + "/#entity/" + s1.community.id + ".council");
await expect(main(founder).getByRole("heading", { level: 1 })).toHaveText("Local council");
await founder.page.getByRole("button", { name: "Discuss in The Commons" }).click();
await founder.page.getByLabel(/Headline or question/).fill("QA " + stamp + ": When does the council take public comment?");
await founder.page.getByLabel(/In your own words/).fill("Synthetic QA question for a town commons.");
await founder.page.getByRole("button", { name: "Post to The Commons" }).click();
// Publishing opens the new thread; wait for it before navigating away.
await expect(founder.page).toHaveURL(/#post\//);
await expect(main(founder)).toContainText("When does the council take public comment?");
await founder.page.goto(origin + "/#explore");
await expect(founder.page.getByRole("heading", { level: 1 })).toHaveText("Around Burlington.");
if (!process.env.POLIS_SKIP_OSM) await expect(founder.page.locator(".civic-map-list li").first()).toBeVisible();
await shot(founder, "f-town-map-desktop");

// G: a second member finds the same town (no duplicate) and sees the discussion.
const neighbor = await actor("beta_c", 390);
await ensureProfile(neighbor, "town_neighbor_" + stamp.slice(-5));
const found = await findTown(neighbor, "burlington", "Burlington");
await expect(found.existing.first()).toBeVisible();
await found.existing.first().click();
await expect(main(neighbor)).toContainText("What’s happening around Burlington today.");
assert.equal((await state(neighbor)).community.id, s1.community.id);
await neighbor.page.goto(origin + "/#commons/local");
await expect(main(neighbor)).toContainText("When does the council take public comment?");
await shot(neighbor, "g-town-commons-mobile");

// H: a student whose university has no community yet founds its campus commons.
const student = await actor("campus_new");
await ensureProfile(student, "campus_new_" + stamp.slice(-5));
await student.page.goto(origin + "/#communities");
const campusState = await state(student);
if (campusState.unclaimedCampusDomain) {
  await expect(main(student)).toContainText("Start the campus commons for example.edu");
  await student.page.getByLabel("University name").fill("Example University");
  await student.page.getByLabel("Campus town").fill("Burlington, Vermont");
  await student.page.getByRole("button", { name: "Find", exact: true }).click();
  await student.page.locator(".find-choices label").first().click();
  await student.page.getByRole("button", { name: "Start the campus commons" }).click();
  // Founding imports public places, then opens the new Home.
  await expect(main(student)).toContainText("What’s happening around Example University today.");
}
await expect.poll(async () => (await state(student)).community?.campus?.university).toBe("Example University");
await student.page.goto(origin + "/#commons");
await expect(main(student).locator(".commons-tabs")).toContainText("Campus");
await shot(student, "h-new-campus-commons-desktop");

// I: "near me" finds nearby communities from rounded device coordinates.
const nearby = await actor("beta_c", 390, { geolocation: { latitude: 44.48, longitude: -73.21 }, permissions: ["geolocation"] });
await nearby.page.goto(origin + "/#communities");
await nearby.page.getByRole("button", { name: /Use my location|Show communities near me/ }).click();
await nearby.page.getByRole("button", { name: /Show communities near me/ }).click().catch(() => {});
await expect(main(nearby).locator(".find-row").filter({ hasText: "Burlington" }).first()).toBeVisible();
await expect(main(nearby).locator(".find-row").filter({ hasText: "mi" }).first()).toBeVisible();
await shot(nearby, "i-near-me-mobile");

await browser.close();
assert.deepEqual(errors, []);
console.log("Anywhere journeys F–I passed. Screenshots:", output);
