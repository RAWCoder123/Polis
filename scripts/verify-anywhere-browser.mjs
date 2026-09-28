import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";
import { expect as baseExpect } from "playwright/test";

// Polis beyond the configured campuses: find, start and join a town commons,
// found a campus under a new university domain, and discover communities near
// you. Synthetic LOCAL identities only (POLIS_TEST_ACCOUNTS=1); the founder and
// neighbor are new run-scoped accounts, so the suite can repeat on one database
// (later runs join the existing Burlington commons). Uses the real
// OpenStreetMap place search and public-place import through the local Worker;
// set POLIS_SKIP_OSM=1 on networks where those services are blocked.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5173";
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin), "Local origins only.");
const expect = baseExpect.configure({ timeout: 30000 });
const output = "/tmp/polis-anywhere-qa";
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const errors = [];
const stamp = Date.now().toString(36);

async function actor(account, width = 1440, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(account + ": " + e.message));
  // The shell writes its starting URL into history before it requests its
  // first snapshot; an in-page route change made earlier can be overwritten.
  await Promise.all([
    page.waitForRequest((r) => r.url().startsWith(origin + "/api/polis")),
    page.goto(origin + "/signin-with-chatgpt?test_account=" + account + "&return_to=" + encodeURIComponent("/#home")),
  ]);
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
const founder = await actor("qa_anywhere_" + stamp + "_founder");
const created = await ensureProfile(founder, "town_founder_" + stamp.slice(-5));
if (created) await expect(founder.page.getByRole("heading", { name: "Polis is a commons for a real place." })).toBeVisible();
const { existing, start } = await findTown(founder, "Burlington, Vermont", "Burlington");
await shot(founder, "f-find-community-desktop");
if (await start.isVisible().catch(() => false)) await start.click();
else await existing.first().click();
await expect(main(founder)).toContainText("What’s happening around Burlington today.");
const s1 = await state(founder);
assert.equal(s1.community.locality.city, "Burlington");
// Public places import in the background after founding. When OpenStreetMap is
// busy the map offers to add them again, which is the path members would take.
if (!process.env.POLIS_SKIP_OSM) {
  const placeCount = async () => (await state(founder)).places.length;
  try {
    await expect.poll(placeCount, { timeout: 60000 }).toBeGreaterThan(0);
  } catch {
    console.log("Background place import did not finish; retrying from the map.");
    await founder.page.goto(origin + "/#explore");
    await founder.page.getByRole("button", { name: "Add public places" }).click();
    await expect.poll(placeCount, { timeout: 90000 }).toBeGreaterThan(0);
    await founder.page.goto(origin + "/#home");
  }
}
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
const neighbor = await actor("qa_anywhere_" + stamp + "_neighbor", 390);
await ensureProfile(neighbor, "town_neighbor_" + stamp.slice(-5));
const found = await findTown(neighbor, "burlington", "Burlington");
await expect(found.existing.first()).toBeVisible();
await found.existing.first().click();
await expect(main(neighbor)).toContainText("What’s happening around Burlington today.");
assert.equal((await state(neighbor)).community.id, s1.community.id);
await neighbor.page.goto(origin + "/#commons/local");
await expect(main(neighbor)).toContainText("When does the council take public comment?");
await shot(neighbor, "g-town-commons-mobile");

// H: a university email is not enough on its own. Sites does not assert that
// sign-in emails are verified, so campus founding is not offered and the
// server refuses it; campuses are joined with invitation codes. The verified
// founding path is covered by tests/anywhere.test.ts.
const student = await actor("campus_new");
await ensureProfile(student, "campus_new_" + stamp.slice(-5));
await student.page.goto(origin + "/#communities");
const campusState = await state(student);
assert.equal(campusState.unclaimedCampusDomain, null);
await expect(main(student)).toContainText("Polis is a commons for a real place.");
await expect(main(student)).not.toContainText("Start the campus commons");
const refused = await student.context.request.post(origin + "/api/polis", {
  headers: { Origin: origin },
  data: { requestId: crypto.randomUUID(), data: { action: "community.create", kind: "campus", university: "Example University", city: "Burlington", region: "Vermont", country: "US", latitude: 44.4759, longitude: -73.2121, timezone: "America/New_York" } },
});
assert.equal(refused.status(), 403);
await shot(student, "h-unverified-campus-desktop");

// I: "near me" finds nearby communities from rounded device coordinates.
const nearby = await actor("qa_anywhere_" + stamp + "_neighbor", 390, { geolocation: { latitude: 44.48, longitude: -73.21 }, permissions: ["geolocation"] });
await nearby.page.goto(origin + "/#communities");
await nearby.page.getByRole("button", { name: /Use my location|Show communities near me/ }).click();
await nearby.page.getByRole("button", { name: /Show communities near me/ }).click().catch(() => {});
await expect(main(nearby).locator(".find-row").filter({ hasText: "Burlington" }).first()).toBeVisible();
await expect(main(nearby).locator(".find-row").filter({ hasText: "mi" }).first()).toBeVisible();
await shot(nearby, "i-near-me-mobile");

await browser.close();
assert.deepEqual(errors, []);
console.log("Anywhere journeys F–I passed. Screenshots:", output);
