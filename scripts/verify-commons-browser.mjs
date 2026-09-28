import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { expect as baseExpect } from "playwright/test";

// Synthetic, isolated LOCAL accounts only. No hosted identity verification claim.
const origin = process.env.POLIS_TEST_ORIGIN ?? "http://localhost:5182";
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
const expect = baseExpect.configure({ timeout: 20000 });
const output = "/tmp/polis-commons-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const stamp = Date.now().toString(36);
async function actor(account, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
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
  assert.equal(r.status(), 200, await r.text()); return r.json();
}
async function login(a, route = "home") {
  // The shell writes its starting URL into history before it requests its
  // first snapshot; an in-page route change made earlier can be overwritten.
  await Promise.all([
    a.page.waitForRequest(r => r.url().startsWith(origin + "/api/polis")),
    a.page.goto(origin + "/signin-with-chatgpt?test_account=" + a.account + "&return_to=" + encodeURIComponent("/#" + route)),
  ]);
}
async function shot(a, name, mask = []) {
  await expect(a.page.getByRole("combobox", { name: "Current community" })).toBeVisible();
  await expect(a.page.getByText("Loading your community…", { exact: true })).toHaveCount(0);
  assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + " horizontal overflow");
  await a.page.screenshot({ path: output + "/" + name + ".png", mask });
}
async function join(a, campus, code) {
  await a.page.goto(origin + "/#join/" + campus); await a.page.reload();
  const another = a.page.getByRole("button", { name: "Use another code" });
  if (await another.isVisible()) await another.click();
  await a.page.getByRole("textbox", { name: "Invite code", exact: true }).fill(code);
  await a.page.getByRole("button", { name: "Check code", exact: true }).click();
  await expect(a.page.getByRole("heading", { name: "Your community is waiting." })).toBeVisible();
  const signin = a.page.getByRole("link", { name: "Confirm community & sign in" });
  if (await signin.isVisible()) {
    await a.page.route("**/signin-with-chatgpt?**", route => {
      const url = new URL(route.request().url()); url.searchParams.set("test_account", a.account);
      return route.continue({ url: url.href });
    });
    await signin.click();
  }
  await expect(a.page.locator(".invitation-entry form button").last()).toBeVisible();
  const name = a.page.getByRole("textbox", { name: "Your name", exact: true });
  if (await name.isVisible()) {
    await name.fill("Test " + a.account);
    await a.page.getByRole("textbox", { name: "Username", exact: true }).fill("commons_" + a.account);
  }
  await a.page.locator(".invitation-entry form button").last().click();
  await expect(a.page).not.toHaveURL(/#join/);
  await a.page.reload();
}
try {
  const owner = await actor("1"); await login(owner, "admin");
  if ((await state(owner)).status === "onboarding") await command(owner, { action: "account.create", name: "Test curator", username: "commons_curator" });
  const campuses = [];
  for (const [campus, topic, org, label] of [["ithaca", "cornell-transit", "cornell-circle", "Cornell / Ithaca"], ["uf", "uf-transit", "uf-circle", "UF / Gainesville"]]) {
    await command(owner, { action: "community.manage", communityId: campus });
    await owner.page.goto(origin + "/#event-manager"); await owner.page.reload();
    await expect(owner.page.getByRole("heading", { name: "Events worth showing up for." })).toBeVisible();
    await expect(owner.page.getByRole("button", { name: /Import .* checked pilot listings/ })).toHaveCount(1);
    await owner.page.getByRole("button", { name: "Add an occurrence" }).click();
    await expect(owner.page.getByRole("dialog").getByRole("textbox", { name: "City", exact: true })).toHaveValue(campus === "uf" ? "Gainesville" : "Ithaca");
    await owner.page.keyboard.press("Escape");
    const code = await command(owner, { action: "invite.code", communityId: campus, expiresDays: 1, maxUses: 10 });
    const people = [];
    for (const [letter, width] of [["a", 390], ["b", 1440], ["c", 390]]) {
      const a = await actor(campus + "_" + letter, width); people.push(a);
      await join(a, campus, code.invitationCode);
      const s = await state(a); assert.equal(s.community.id, campus); assert.equal(s.me.role, "member");
    }
    const [a, b, c] = people;
    await a.page.goto(origin + "/#commons");
    await expect(a.page.getByRole("button", { name: "Question", exact: true })).toBeVisible();
    await a.page.getByText("Topics, groups & notifications", { exact: true }).click();
    const optin = a.page.getByRole("button", { name: "Enable in-app reply notifications" });
    // The opt-in is a write; publishing before it settles is rejected as a
    // concurrent change, so wait until the saved preference hides it.
    if (await optin.isVisible()) { await optin.click(); await expect(optin).toHaveCount(0); }
    await command(b, { action: "preferences", replies: true, reactions: true, issues: false, events: false });
    await a.page.getByRole("button", { name: "Question", exact: true }).click();
    const dialog = a.page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Subject", exact: true }).selectOption(topic);
    const text = "Local QA " + stamp + ": how could getting to campus be easier?";
    await dialog.getByRole("textbox", { name: "Your question", exact: true }).fill(text);
    await dialog.getByRole("combobox", { name: "Who can see this?" }).selectOption("community");
    await dialog.getByRole("button", { name: "Post to The Commons", exact: true }).click();
    await expect(a.page).toHaveURL(/#post\//);
    // Conversation links carry their community (Codex WIP): #post/<id>?community=<campus>.
    const postId = a.page.url().split("#post/")[1].split("?")[0];
    await b.page.goto(origin + "/#post/" + postId); await b.page.reload();
    await expect(b.page.getByText(text, { exact: true })).toBeVisible();
    await b.page.getByRole("textbox", { name: "Join the conversation" }).fill("Local QA reply: clearer route information would help.");
    await b.page.locator(".reply-form").getByRole("button", { name: "Reply", exact: true }).click();
    await expect(b.page.getByText("Local QA reply: clearer route information would help.", { exact: true })).toBeVisible();
    await a.page.goto(origin + "/#notifications"); await a.page.reload();
    const notice = (await state(a)).notifications.find(n => n.targetId === postId);
    assert.ok(notice?.commentId);
    await a.page.locator(".notification-row").filter({ hasText: "replied to your conversation" }).first().click();
    await expect(a.page).toHaveURL(new RegExp("#post/" + postId + "/" + notice.commentId + "(\\?community=" + campus + ")?$"));
    await expect(a.page.locator("#comment-" + notice.commentId)).toBeVisible();
    await a.page.getByRole("button", { name: "Follow thread", exact: true }).click();
    await a.page.reload();
    assert.equal((await state(a, "?post=" + postId)).posts[0].following, true);
    await shot(a, campus + "-mobile-conversation");
    await shot(b, campus + "-desktop-conversation");
    const eventId = "commons-map-" + campus;
    const event = { id: eventId, seriesId: eventId, title: "SYNTHETIC " + campus + " transit meetup", description: "Local test fixture for topic and map navigation. Not a real event.", organizer: "Synthetic organizer", sourceUrl: "https://example.test/event", checkedAt: new Date().toISOString(), venue: "Synthetic venue " + campus, address: "Synthetic address", city: campus === "uf" ? "Gainesville" : "Ithaca", latitude: campus === "uf" ? 29.65 : 42.44, longitude: campus === "uf" ? -82.34 : -76.49, imageUrl: "", startsAt: "2099-09-20T14:00:00.000Z", endsAt: "2099-09-20T15:00:00.000Z", timezone: "America/New_York", category: "civic_meetings", cost: "unknown", costDetails: "", accessibility: "", registration: "", registrationUrl: "", issueId: topic, status: "published", sample: true };
    await command(owner, { action: "event.save", event });
    await a.page.goto(origin + "/#topic/" + topic);
    await expect(a.page.getByRole("heading", { name: "Sourced background" })).toBeVisible();
    const follow = a.page.getByRole("button", { name: "Follow topic", exact: true });
    if (await follow.isVisible()) await follow.click();
    const topicNotifications = a.page.getByRole("checkbox", { name: "Notify me in Polis when a curator adds an update" });
    if (!await topicNotifications.isChecked()) await topicNotifications.click();
    await expect(topicNotifications).toBeChecked();
    await command(owner, { action: "issue.update", issueId: topic, title: "Local QA curator source " + stamp, sourceUrl: campus === "uf" ? "https://taps.ufl.edu/fall2026transit/" : "https://tcatbus.com/tcats-2026-fall-service/", sample: true });
    await a.page.reload(); await expect(a.page.getByRole("link", { name: "Local QA curator source " + stamp })).toBeVisible();
    await shot(a, campus + "-mobile-topic");
    await a.page.locator(".entity-events .entity-row").filter({ hasText: event.title }).click();
    await expect(a.page.getByRole("heading", { name: event.title, exact: true })).toBeVisible();
    await a.page.getByRole("button", { name: "Explore the related issue" }).click();
    await a.page.route("**/maps/*.geojson", route => route.abort());
    await a.page.getByRole("button", { name: "Explore the local map and event list" }).click();
    await expect(a.page.getByRole("textbox", { name: "Discovery city" })).toHaveValue(event.city);
    await expect(a.page.getByText("The local outline could not load. Venues and the complete event list remain available.", { exact: true })).toBeVisible();
    await a.page.locator('.leaflet-marker-icon[title^="Synthetic venue"]').first().dispatchEvent("click"); // nearby sample listings can overlap this pin
    await expect(a.page).toHaveURL(new RegExp("selected=" + eventId));
    await a.page.getByRole("button", { name: "Use my location", exact: true }).click();
    await expect(a.page.getByText("Location was not shared. You can still browse by city.", { exact: true })).toBeVisible();
    await shot(a, campus + "-mobile-map-fallback");
    await a.page.getByRole("button", { name: "List", exact: true }).click();
    await expect(a.page.getByRole("region", { name: "Event venues map" })).toHaveCount(0);
    await a.page.goto(origin + "/#commons");
    await a.page.locator(".forum-filters").getByRole("button", { name: "Following", exact: true }).click();
    await expect(a.page.getByText(text, { exact: true })).toBeVisible();
    await a.page.setViewportSize({ width: 320, height: 740 }); await shot(a, campus + "-small-home");
    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.keyboard.press("Tab");
    assert.ok(await a.page.evaluate(() => document.activeElement !== document.body));
    await command(owner, { action: "organization.member", organizationId: org, userId: (await state(a)).me.id, role: "organizer" });
    await a.page.goto(origin + "/#organization/" + org + "/discussion"); await a.page.reload();
    await a.page.getByText("Organization invitation codes", { exact: true }).click();
    await a.page.getByRole("button", { name: "Generate organization code" }).click();
    const orgCode = a.page.getByRole("textbox", { name: "Organization code", exact: true });
    await expect(orgCode).toBeVisible();
    await join(b, campus, await orgCode.inputValue());
    assert.equal((await state(b)).organizations.find(o => o.id === org).role, "member");
    await a.page.getByRole("tab", { name: "Announcements", exact: true }).click();
    await a.page.getByRole("button", { name: "Write an announcement" }).click();
    await dialog.getByRole("textbox", { name: "Your question", exact: true }).fill("Local QA private organization announcement " + stamp);
    await dialog.getByRole("combobox", { name: "Who can see this?" }).selectOption("community");
    await dialog.getByRole("button", { name: "Publish to organization members" }).click();
    await expect(a.page).toHaveURL(/#post\//);
    const privateId = a.page.url().split("#post/")[1].split("?")[0];
    await b.page.goto(origin + "/#post/" + privateId); await b.page.reload();
    await expect(b.page.getByText("Local QA private organization announcement " + stamp, { exact: true })).toBeVisible();
    await b.page.getByRole("textbox", { name: "Join the conversation" }).fill("Local QA member reply in the organization.");
    await b.page.locator(".reply-form").getByRole("button", { name: "Reply", exact: true }).click();
    await expect(b.page.getByText("Local QA member reply in the organization.", { exact: true })).toBeVisible();
    assert.equal((await c.context.request.get(origin + "/api/polis?post=" + privateId)).status(), 404);
    assert.ok(!(await state(c, "?filter=community")).posts.some(p => p.id === privateId));
    await b.page.goto(origin + "/#organization/" + org + "/announcements"); await b.page.reload();
    await shot(b, campus + "-desktop-organization");
    await a.page.goto(origin + "/#home"); await a.page.reload(); await shot(a, campus + "-mobile-home");
    campuses.push({ campus, people, privateId, postId });
    console.log("PASS " + label + ": 3 separate sessions, campus invitation, question, reply, exact notification, follow, sources, organization announcement, reload, member isolation and responsive layout.");
  }
  for (const scope of campuses) {
    const other = campuses.find(s => s !== scope).people[0];
    const denied = await other.context.request.get(origin + "/api/polis?community=" + scope.campus + "&post=" + scope.privateId);
    assert.equal(denied.status(), 403);
    assert.equal((await other.context.request.get(origin + "/api/polis?post=" + scope.privateId)).status(), 404);
  }
  assert.deepEqual(errors, []);
  console.log("PASS campus isolation and zero browser runtime errors. Screenshots: " + output);
} finally { await browser.close(); }
